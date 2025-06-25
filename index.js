const fs = require('node:fs');
const cron = require('node-cron');
const path = require('node:path');
const {
    Client, Collection, GatewayIntentBits, Events, Partials, PermissionsBitField,
    ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ActivityType
} = require('discord.js');
require('dotenv').config();

// Import review handler functions
const { handleFeedbackLeaveReviewClick, handleFeedbackModalSubmit, updateShopMessage } = require('./handlers/reviewHandler');

// =================================================================
// SECTION 1: CONFIGURATION AND STATE MANAGEMENT
// =================================================================

const PREFIX = '!';
const AFFILIATE_DISCOUNT_RATE = 0.05;

const securityConfig = {
    logChannelId: process.env.LOG_CHANNEL_ID,
    authorizedUsers: process.env.AUTHORIZED_USERS ? process.env.AUTHORIZED_USERS.split(',') : [],
    phishingDomains: [],
    dangerousExtensions: ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar'],
    spamThreshold: 5,
    spamTimeWindow: 5000,
    warningLimit: 3,
    timeoutDuration: 3600000,
};
const feedbackConfig = {
    testimonialChannelId: process.env.TESTIMONIAL_CHANNEL_ID,
    feedbackLogChannelId: process.env.FEEDBACK_LOG_CHANNEL_ID,
};
const commissionTiers = {
    0: 0.02, 100: 0.05, 500: 0.07, 1000: 0.10,
};
const orderLogConfig = {
    channelId: process.env.ORDER_LOG_CHANNEL_ID
};
const settings = {
    ticketCategoryId: null,
    supportCategoryId: null,
    testMode: false,
};

const warnings = new Map();
const violationHistory = new Map();
const messageTracker = new Map();
const ticketOwners = new Map();
const orders = [];
const pendingOrders = new Map();
const affiliates = new Map();
const affiliateTiers = [];
const giveaways = new Map();
const products = [];
const purchaseState = new Map();
const orderCooldowns = new Map();

// =================================================================
// SECTION 2: DISCORD CLIENT SETUP
// =================================================================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ],
    partials: [Partials.Channel],
});

client.commands = new Collection();
client.prefixCommands = new Collection();
client.security = { config: securityConfig, warnings, violationHistory };
client.feedback = { config: feedbackConfig };
client.commissions = { tiers: commissionTiers };
client.ticketOwners = ticketOwners;
client.orders = orders;
client.pendingOrders = pendingOrders;
client.affiliates = affiliates;
client.affiliateTiers = affiliateTiers;
client.giveaways = giveaways;
client.products = products;
client.purchaseState = purchaseState;
client.orderLogConfig = orderLogConfig;
client.settings = settings;
client.orderCooldowns = orderCooldowns;

// =================================================================
// SECTION 3: COMMAND AND EVENT HANDLER REGISTRATION
// =================================================================

const commandsPath = path.join(__dirname, 'commands');
function findAndLoadCommands(directory) {
    const items = fs.readdirSync(directory);
    for (const item of items) {
        const itemPath = path.join(directory, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
            if (path.basename(itemPath) !== 'payment') {
                findAndLoadCommands(itemPath);
            }
        } else if (item.endsWith('.js')) {
            try {
                const command = require(itemPath);
                if ('data' in command && 'execute' in command) {
                    command.filePath = itemPath;
                    client.commands.set(command.data.name, command);
                }
            } catch(error) {
                console.error(`Failed to load slash command at ${itemPath}:`, error);
            }
        }
    }
}
findAndLoadCommands(commandsPath);

const paymentCommandsPath = path.join(__dirname, 'commands', 'payment');
if (fs.existsSync(paymentCommandsPath)) {
    const paymentCommandFiles = fs.readdirSync(paymentCommandsPath).filter(file => file.endsWith('.js'));
    for (const file of paymentCommandFiles) {
        const command = require(path.join(paymentCommandsPath, file));
        client.prefixCommands.set(command.name, command);
    }
}

client.once(Events.ClientReady, onReady);
client.on(Events.InteractionCreate, onInteractionCreate);
client.on(Events.MessageCreate, onMessageCreate);

// =================================================================
// SECTION 4: PRIMARY EVENT HANDLER LOGIC
// =================================================================

function onReady(readyClient) {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    readyClient.user.setActivity('$server', { type: ActivityType.Watching });

    loadStateFromFile(warnings, 'warnings.json');
    loadStateFromFile(violationHistory, 'violation_history.json');
    loadPhishingDomains();
    loadArrayStateFromFile(orders, 'orders.json');
    loadStateFromFile(affiliates, 'affiliates.json');
    loadArrayStateFromFile(affiliateTiers, 'affiliate_tiers.json');
    loadStateFromFile(giveaways, 'giveaways.json');
    loadArrayStateFromFile(products, 'products.json');
    loadSettings();
    setInterval(() => checkGiveaways(client), 15 * 1000);
    setInterval(() => checkTickets(client), 60 * 60 * 1000);
    cron.schedule('59 23 * * *', () => sendDailySummary(client), {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });
}

async function onInteractionCreate(interaction) {
    if (interaction.isChatInputCommand()) await handleSlashCommand(interaction);
    else if (interaction.isButton()) await handleButton(interaction);
    else if (interaction.isModalSubmit()) await handleModal(interaction);
    else if (interaction.isStringSelectMenu()) await handleSelectMenu(interaction);
    else if (interaction.isAutocomplete()) await handleAutocomplete(interaction);
}

async function onMessageCreate(message) {
    if (message.content.startsWith(PREFIX) && !message.author.bot) {
        await handlePrefixCommand(message);
        return;
    }
    if (message.author.bot || !message.guild || client.security.config.authorizedUsers.includes(message.author.id)) return;
    if (detectPhishing(message.content)) return handleViolation(message, 'phishing', 'Phishing link detected');
    if (detectDangerousFile(message.attachments)) return handleViolation(message, 'dangerous_file', 'Dangerous file extension');
    if (detectSpam(message.author.id, message.channel.id)) return handleViolation(message, 'spam', 'Message spam detected');
}

// =================================================================
// SECTION 5: INTERACTION SUB-HANDLERS
// =================================================================

async function handleSlashCommand(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;
    const isAdminCommand = command.isAdmin || command.isSecurityCommand;
    if (isAdminCommand) {
        const member = interaction.member;
        const isRootUser = securityConfig.authorizedUsers.includes(member.id);
        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasBotAdminRole = member.roles.cache.some(role => role.name === 'Bot Admin');
        if (!isRootUser && !isAdmin && !hasBotAdminRole) {
            return interaction.reply({ content: 'You do not have the required permissions for this command.', ephemeral: true });
        }
    }
    try { await command.execute(interaction); }
    catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) { await interaction.followUp({ content: 'An error occurred!', ephemeral: true }); }
        else { await interaction.reply({ content: 'An error occurred!', ephemeral: true }); }
    }
}

async function handleButton(interaction) {
    const { customId } = interaction;
    try {
        if (customId === 'support_ticket_create') await handleSupportTicketCreate(interaction);
        else if (customId.startsWith('giveaway_enter')) await handleGiveawayEntry(interaction);
        else if (customId.startsWith('purchase_initiate')) await handlePurchaseInitiation(interaction);
        else if (customId === 'purchase_confirm_ticket') await handlePurchaseConfirmation(interaction);
        else if (customId === 'purchase_redeem_code') await handleRedeemButton(interaction);
        else if (customId === 'purchase_cancel') await interaction.update({ content: 'Purchase cancelled.', components: [], embeds: [] });
        else if (customId === 'ticket_ready') await handleTicketReadyButton(interaction);
        else if (customId.startsWith('feedback_leave_review')) await handleFeedbackLeaveReviewClick(interaction);
        else if (customId.startsWith('feedback_no_thanks')) await interaction.update({ content: 'Thank you for your time.', components: [] });
    } catch (error) { console.error(`Error handling button ${customId}:`, error); }
}

async function handleModal(interaction) {
    const { customId } = interaction;
    try {
        if (customId === 'support_ticket_modal') await handleSupportModalSubmit(interaction);
        else if (customId.startsWith('purchase_quantity_modal_') || customId.startsWith('purchase_form_'))
            await handlePurchaseFormSubmit(interaction);
        else if (customId.startsWith('feedback_review_modal')) await handleFeedbackModalSubmit(interaction);
    } catch (error) { console.error(`Error handling modal ${customId}:`, error); }
}

async function handleSelectMenu(interaction) {
    const { customId } = interaction;
    try {
        if (customId.startsWith('purchase_variant_select')) await handleVariantSelection(interaction);
    } catch (error) { console.error(`Error handling select menu ${customId}:`, error); }
}

async function handleAutocomplete(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;
    try { await command.autocomplete(interaction); }
    catch (error) { console.error('Autocomplete error:', error); }
}

async function handlePrefixCommand(message) {
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.prefixCommands.get(commandName);
    if (!command) return;
    const member = message.member;
    const isRootUser = securityConfig.authorizedUsers.includes(member.id);
    const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
    const hasBotAdminRole = member.roles.cache.some(role => role.name === 'Bot Admin');
    if (!isRootUser && !isAdmin && !hasBotAdminRole) return;
    try { command.execute(message, args); }
    catch (error) { console.error(`Error executing prefix command ${commandName}:`, error); message.reply('An error occurred!'); }
}

// =================================================================
// SECTION 6: CORE BOT FEATURE LOGIC
// =================================================================


// --- NEW: Daily Summary ---
async function sendDailySummary(client) {
    const logChannelId = client.orderLogConfig.channelId;
    if (!logChannelId) return;
    const logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysOrders = client.orders.filter(o => o.status === 'completed' && new Date(o.closedAt) >= today);
    
    if (todaysOrders.length === 0) {
        return logChannel.send(`🗓️ **Daily Summary for ${today.toLocaleDateString('en-ID')}**: No orders were completed today.`);
    }

    const totalRevenue = todaysOrders.reduce((sum, order) => sum + order.finalPrice, 0);
    const productCounts = todaysOrders.reduce((acc, order) => {
        acc[order.productName] = (acc[order.productName] || 0) + order.quantity;
        return acc;
    }, {});
    const topSeller = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];

    const embed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle(`🗓️ Order Summary: ${today.toLocaleDateString('en-ID')}`)
        .addFields(
            { name: 'Total Orders', value: `\`${todaysOrders.length}\``, inline: true },
            { name: 'Total Revenue', value: `\`Rp ${totalRevenue.toLocaleString('id-ID')}\``, inline: true },
            { name: 'Top Seller', value: `**${topSeller[0]}** (${topSeller[1]}x)`, inline: false }
        )
        .setTimestamp();
    
    await logChannel.send({ embeds: [embed] });
}


// --- NEW SUPPORT SYSTEM LOGIC ---
async function handleSupportTicketCreate(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('support_ticket_modal')
        .setTitle('After-Purchase Support');

    const orderIdInput = new TextInputBuilder()
        .setCustomId('order_id')
        .setLabel("Your Order ID")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., ORD-20250626-A1B2')
        .setRequired(true);
    
    const issueInput = new TextInputBuilder()
        .setCustomId('issue_description')
        .setLabel("Please describe your issue")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);
    
    modal.addComponents(
        new ActionRowBuilder().addComponents(orderIdInput),
        new ActionRowBuilder().addComponents(issueInput)
    );
    
    await interaction.showModal(modal);
}

async function handleSupportModalSubmit(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const orderId = interaction.fields.getTextInputValue('order_id');
    const issue = interaction.fields.getTextInputValue('issue_description');
    
    // Find the order to validate the user
    const order = client.orders.find(o => o.orderId === orderId && o.userId === interaction.user.id);
    if (!order) {
        return interaction.editReply({ 
            content: 'Invalid Order ID. Please check the invoice sent to your DMs. Ensure you are the original buyer.' 
        });
    }

    const guild = interaction.guild;
    const user = interaction.user;
    const supportRole = guild.roles.cache.find(r => r.name === '┇ᴀᴅᴍɪɴ┇');
    
    // Create or find support category
    let supportCategory = guild.channels.cache.find(c => c.name === "SUPPORT" && c.type === ChannelType.GuildCategory);
    if (!supportCategory) {
        supportCategory = await guild.channels.create({
            name: 'SUPPORT',
            type: ChannelType.GuildCategory
        });
    }
    
    // Set up permissions for the support channel
    const permissionOverwrites = [
        {
            id: guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
            id: user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
            id: client.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
    ];
    
    if (supportRole) {
        permissionOverwrites.push({
            id: supportRole.id,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ManageMessages
            ]
        });
    }

    // Create the support channel
    const supportChannel = await guild.channels.create({
        name: `support-${user.username}`,
        type: ChannelType.GuildText,
        parent: supportCategory.id,
        permissionOverwrites,
        topic: `Support for Order ID: ${orderId}`
    });

    // Create and send the support ticket embed
    const embed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle(`🛡️ Support Ticket Opened`)
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .addFields(
            { 
                name: 'Original Order', 
                value: `**Product:** ${order.productName}\n**Order ID:** \`${order.orderId}\`` 
            },
            { 
                name: 'Reported Issue', 
                value: `\`\`\`${issue}\`\`\`` 
            }
        )
        .setTimestamp();
        
    await supportChannel.send({ 
        content: `${user} ${supportRole || ''}`, 
        embeds: [embed] 
    });
    
    await interaction.editReply({ 
        content: `✅ Your support ticket has been created: ${supportChannel}` 
    });
}

// --- E-commerce System ---
async function handlePurchaseInitiation(interaction) {
    const listingId = interaction.customId.split('_')[2];
    const listing = client.products.find(p => p.id === listingId);
    if (!listing || listing.variants.every(v => v.stock < 1)) {
        return interaction.reply({ content: 'This listing is out of stock or no longer available.', ephemeral: true });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`purchase_variant_select_${listingId}`)
        .setPlaceholder('Select the product variant')
        .addOptions(listing.variants
            .filter(v => v.stock > 0)
            .map(v => ({
                label: v.name,
                description: `Price: Rp ${v.price.toLocaleString('id-ID')} | Stock: ${v.stock}`,
                value: v.name,
            }))
        );
    
    await interaction.reply({
        content: `Please select the specific item you wish to purchase from **${listing.title}**.`,
        components: [new ActionRowBuilder().addComponents(selectMenu)],
        ephemeral: true,
    });
}

async function handleVariantSelection(interaction) {
    const listingId = interaction.customId.split('_')[3];
    const variantName = interaction.values[0];
    const listing = client.products.find(p => p.id === listingId);
    const variant = listing?.variants.find(v => v.name === variantName);

    if (!listing || !variant) {
        return interaction.update({ content: 'This item is no longer available.', components: [] });
    }
    
    client.purchaseState.set(interaction.user.id, { listingId, variantName });

    const modal = new ModalBuilder()
        .setCustomId(`purchase_quantity_modal_${listingId}_${variantName.replace(/\s+/g, '-')}`)
        .setTitle(`Buy: ${variantName}`);
    const quantityInput = new TextInputBuilder().setCustomId('quantity').setLabel(`Quantity (Max: ${variant.stock})`).setStyle(TextInputStyle.Short).setRequired(true).setValue('1');
    const affiliateInput = new TextInputBuilder().setCustomId('affiliate_code').setLabel("Affiliate Code (Optional)").setStyle(TextInputStyle.Short).setRequired(false);
    
    modal.addComponents(new ActionRowBuilder().addComponents(quantityInput), new ActionRowBuilder().addComponents(affiliateInput));
    await interaction.showModal(modal);
}

async function handlePurchaseFormSubmit(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const parts = interaction.customId.split('_');
    const listingId = parts[3];
    const variantName = parts.slice(4).join(' ').replace(/-/g, ' ');
    
    const listing = client.products.find(p => p.id === listingId);
    const variant = listing?.variants.find(v => v.name === variantName);

    if (!listing || !variant) {
        return interaction.editReply({ content: 'This item is no longer available.' });
    }

    const quantity = parseInt(interaction.fields.getTextInputValue('quantity'), 10);
    const affiliateCode = interaction.fields.getTextInputValue('affiliate_code')?.toLowerCase();

    if (isNaN(quantity) || quantity < 1 || quantity > variant.stock) {
        return interaction.editReply({ content: `Invalid quantity. Please enter a number between 1 and ${variant.stock}.` });
    }

    let finalPrice = variant.price * quantity;
    let discountApplied = 0;
    let validAffiliate = null;

    if (affiliateCode) {
        validAffiliate = Array.from(client.affiliates.values()).find(aff => aff.code.toLowerCase() === affiliateCode);

        if (!validAffiliate) {
            return interaction.editReply({ content: `❌ Kode afiliasi \`${affiliateCode}\` tidak ditemukan.` });
        }

        if (validAffiliate.userId === interaction.user.id) {
            return interaction.editReply({ content: `⚠️ Kamu tidak bisa menggunakan kode afiliasi milik sendiri.` });
        }

        discountApplied = finalPrice * AFFILIATE_DISCOUNT_RATE;
        finalPrice -= discountApplied;
    }

    const ticketChannel = await createTicketChannel(interaction.guild, interaction.user);
    const pendingOrderData = {
        orderId: ticketChannel.id, timestamp: new Date().toISOString(), userId: interaction.user.id, username: interaction.user.username,
        productName: `${listing.title} - ${variant.name}`, productId: listing.id,
        pricePerUnit: variant.price, quantity,
        initialPrice: variant.price * quantity,
        discount: discountApplied, finalPrice,
        affiliateCode: validAffiliate ? validAffiliate.code : null, status: 'pending'
    };

    client.pendingOrders.set(ticketChannel.id, pendingOrderData);
    client.ticketOwners.set(ticketChannel.id, interaction.user.id);
    await sendTicketWelcomeMessage(client, ticketChannel, interaction.user, pendingOrderData, listing);
    
    client.purchaseState.delete(interaction.user.id);
    await interaction.editReply({ content: `✅ Ticket created successfully: ${ticketChannel}` });
}

async function createTicketChannel(guild, user) {
    const supportRole = guild.roles.cache.find(r => r.name === '┇ᴀᴅᴍɪɴ┇');
    let parentCategory = client.settings.ticketCategoryId;

    if (!parentCategory) {
        let ticketCategory = guild.channels.cache.find(c => c.name === "TICKETS" && c.type === ChannelType.GuildCategory);
        if (!ticketCategory) ticketCategory = await guild.channels.create({ name: 'TICKETS', type: ChannelType.GuildCategory });
        parentCategory = ticketCategory.id;
    }
    
    const permissionOverwrites = [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }];
    if (supportRole) permissionOverwrites.push({ id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages] });
    
    return await guild.channels.create({ name: `ticket-${user.username}`, type: ChannelType.GuildText, parent: parentCategory, permissionOverwrites });
}

async function sendTicketWelcomeMessage(client, channel, user, orderData, listing) {
    const supportRole = channel.guild.roles.cache.find(r => r.name === '┇ᴀᴅᴍɪɴ┇');
    const embed = new EmbedBuilder()
        .setColor('#FFA500').setTitle(`Pembelian: ${orderData.productName}`)
        .setThumbnail(listing.imageUrl || null)
        .addFields(
            { name: 'Instruksi', value: '• Tunggu staff untuk memproses pesanan.\n• Jangan spam atau tiket akan ditutup.\n• Siapkan pembayaran sesuai harga yang tertera.', inline: false },
            { name: 'Harga', value: `Rp ${orderData.finalPrice.toLocaleString('id-ID')}`, inline: true },
            { name: 'Jumlah', value: `\`${orderData.quantity}\``, inline: true },
            { name: 'Status', value: 'Menunggu Staff', inline: true },
            { name: 'Pembeli', value: `${user}`, inline: false},
            { name: 'Waktu', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false }
        );
        if(orderData.affiliateCode) {
            embed.addFields({ name: 'Kode Afiliasi Digunakan', value: `\`${orderData.affiliateCode}\` (-Rp ${orderData.discount.toLocaleString('id-ID')})`});
        }

    const readyButton = new ButtonBuilder().setCustomId('ticket_ready').setLabel('Ready').setStyle(ButtonStyle.Success).setEmoji('✅');
    const row = new ActionRowBuilder().addComponents(readyButton);
    
    await channel.send({ content: `Halo ${user}! Admin ${supportRole || ''} akan segera membantumu.`, embeds: [embed], components: [row] });
}

async function handleTicketReadyButton(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({ content: 'Only staff can use this button.', ephemeral: true });
    }
    const originalMessage = interaction.message;
    const oldEmbed = originalMessage.embeds[0];
    const newEmbed = EmbedBuilder.from(oldEmbed).setColor('#2ECC71').spliceFields(2, 1, { name: 'Status', value: 'Siap Diproses', inline: true });
    const readyButton = ButtonBuilder.from(originalMessage.components[0].components[0]).setDisabled(true);
    const newRow = new ActionRowBuilder().addComponents(readyButton);
    await originalMessage.edit({ embeds: [newEmbed], components: [newRow] });
    await interaction.reply({ content: 'Ticket status updated. You can now use `/kirim` or `!pay` commands.', ephemeral: true });
}

// --- Giveaway System ---
async function handleGiveawayEntry(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const messageId = interaction.customId.split('_')[2];
    const giveaway = client.giveaways.get(messageId);
    if (!giveaway || giveaway.status === 'ended') {
        return interaction.editReply({ content: 'This giveaway is invalid or has already ended.' });
    }
    if (giveaway.participants.includes(interaction.user.id)) {
        return interaction.editReply({ content: 'You have already entered this giveaway!' });
    }
    giveaway.participants.push(interaction.user.id);
    client.giveaways.set(messageId, giveaway);
    saveGiveaways();
    await interaction.editReply({ content: 'You have successfully entered the giveaway!' });
}

async function checkGiveaways(client) {
    const now = Date.now();
    for (const [messageId, giveaway] of client.giveaways.entries()) {
        if (giveaway.status === 'running' && giveaway.endTime <= now) {
            await endGiveaway(client, messageId, giveaway);
        }
    }
}

async function endGiveaway(client, messageId, giveaway) {
    console.log(`Ending giveaway: ${messageId}`);
    giveaway.status = 'ended';
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) {
        console.error(`Giveaway channel ${giveaway.channelId} not found.`);
        client.giveaways.set(messageId, giveaway);
        saveGiveaways();
        return;
    }
    const message = await channel.messages.fetch(messageId).catch(() => null);
    const participants = giveaway.participants;
    let winners = [];
    const requiredWinnerId = giveaway.requiredWinnerId;
    if (requiredWinnerId && participants.includes(requiredWinnerId)) {
        winners = [requiredWinnerId];
    } else {
        if (participants.length > 0) {
            const shuffled = participants.sort(() => 0.5 - Math.random());
            winners = shuffled.slice(0, giveaway.winnerCount);
        }
    }
    giveaway.winners = winners;
    client.giveaways.set(messageId, giveaway);
    saveGiveaways();
    if (message) {
        const embed = new EmbedBuilder(message.embeds[0].data).setColor('#DC143C').setTitle(`🎉 GIVEAWAY ENDED 🎉`).setDescription(`This giveaway for **${giveaway.prize}** has ended.\n\nWinners: ${winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'No one entered!'}`);
        const newButton = new ButtonBuilder().setCustomId(`giveaway_ended_${messageId}`).setLabel('Giveaway Ended').setStyle(ButtonStyle.Secondary).setDisabled(true);
        await message.edit({ embeds: [embed], components: [new ActionRowBuilder().addComponents(newButton)] });
    }
    if (winners.length > 0) {
        await channel.send({ content: `Congratulations ${winners.map(w => `<@${w}>`).join(', ')}! You won the **${giveaway.prize}**!`, allowedMentions: { users: winners } });
    } else {
        await channel.send({ content: `The giveaway for **${giveaway.prize}** has ended with no participants.` });
    }
}

// --- Auto-Ticket Cleaner ---
async function checkTickets(client) {
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    const categoryId = client.settings.ticketCategoryId;
    if (!categoryId) return;
    try {
        const category = await client.channels.fetch(categoryId);
        category.children.cache.forEach(async (channel) => {
            if (channel.name.startsWith('ticket-') || channel.name.startsWith('support-')) {
                const lastMessage = await channel.messages.fetch({ limit: 1 }).then(msgs => msgs.first());
                if (!lastMessage || lastMessage.createdTimestamp < threeDaysAgo) {
                    console.log(`Auto-deleting inactive ticket: ${channel.name}`);
                    await channel.delete().catch(e => console.error(`Failed to auto-delete ticket:`, e));
                }
            }
        });
    } catch(e) { console.error("Ticket cleaner failed to fetch category:", e); }
}

// NEW: Support System Logic
async function handleSupportTicketCreate(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('support_ticket_modal')
        .setTitle('After-Purchase Support');

    const orderIdInput = new TextInputBuilder().setCustomId('order_id').setLabel("Your Order ID").setStyle(TextInputStyle.Short).setPlaceholder('e.g., ORD-20250626-A1B2').setRequired(true);
    const issueInput = new TextInputBuilder().setCustomId('issue_description').setLabel("Please describe your issue").setStyle(TextInputStyle.Paragraph).setRequired(true);
    
    modal.addComponents(new ActionRowBuilder().addComponents(orderIdInput), new ActionRowBuilder().addComponents(issueInput));
    await interaction.showModal(modal);
}

async function handleSupportModalSubmit(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const orderId = interaction.fields.getTextInputValue('order_id');
    const issue = interaction.fields.getTextInputValue('issue_description');
    
    const order = client.orders.find(o => o.orderId === orderId && o.userId === interaction.user.id);
    if (!order) {
        return interaction.editReply({ content: 'Invalid Order ID. Please check the invoice sent to your DMs. Ensure you are the original buyer.' });
    }

    const guild = interaction.guild;
    const user = interaction.user;
    const supportRole = guild.roles.cache.find(r => r.name === '┇ᴀᴅᴍɪɴ┇');
    let parentCategory = client.settings.supportCategoryId;

    if (!parentCategory) {
        let supportCategory = guild.channels.cache.find(c => c.name === "SUPPORT" && c.type === ChannelType.GuildCategory);
        if (!supportCategory) supportCategory = await guild.channels.create({ name: 'SUPPORT', type: ChannelType.GuildCategory });
        parentCategory = supportCategory.id;
    }

    const permissionOverwrites = [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }];
    if (supportRole) permissionOverwrites.push({ id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages] });

    const supportChannel = await guild.channels.create({
        name: `support-${user.username}`,
        type: ChannelType.GuildText,
        parent: parentCategory,
        permissionOverwrites,
        topic: `Support for Order ID: ${orderId}`
    });

    const embed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle(`🛡️ Support Ticket Opened`)
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .addFields(
            { name: 'Original Order', value: `**Product:** ${order.productName}\n**Order ID:** \`${order.orderId}\`` },
            { name: 'Reported Issue', value: `\`\`\`${issue}\`\`\`` }
        )
        .setTimestamp();
        
    await supportChannel.send({ content: `${user} ${supportRole || ''}`, embeds: [embed] });
    await interaction.editReply({ content: `✅ Your support ticket has been created: ${supportChannel}` });
}

// =================================================================
// SECTION 7: DATA PERSISTENCE AND SECURITY
// =================================================================
function saveStateToFile(data, fileName) { try { const dataToSave = data instanceof Map ? Object.fromEntries(data) : data; fs.writeFileSync(path.join(__dirname, fileName), JSON.stringify(dataToSave, null, 2)); } catch (error) { console.error(`[DB] Error saving ${fileName}:`, error); } }
function loadStateFromFile(map, fileName) { const filePath = path.join(__dirname, fileName); try { if (fs.existsSync(filePath)) { const data = fs.readFileSync(filePath, 'utf8'); Object.entries(JSON.parse(data)).forEach(([key, value]) => map.set(key, value)); console.log(`[DB] Loaded data from ${fileName}.`); } else { fs.writeFileSync(filePath, '{}', 'utf8'); console.log(`[DB] Created empty ${fileName}.`);}} catch (error) { console.error(`[DB] Error loading ${fileName}:`, error); } }
function loadArrayStateFromFile(arr, fileName) { const filePath = path.join(__dirname, fileName); try { if (fs.existsSync(filePath)) { const fileData = fs.readFileSync(filePath, 'utf8'); arr.splice(0, arr.length, ...JSON.parse(fileData)); console.log(`[DB] Loaded ${arr.length} items from ${fileName}.`); } else { fs.writeFileSync(filePath, '[]', 'utf8'); console.log(`[DB] Created empty ${fileName}.`); } } catch (error) { console.error(`[DB] Error loading ${fileName}:`, error); } }
function loadPhishingDomains() { const filePath = path.join(__dirname, 'phishing_domains.json'); try { if (fs.existsSync(filePath)) { client.security.config.phishingDomains = JSON.parse(fs.readFileSync(filePath, 'utf8')); console.log(`[DB] Loaded ${client.security.config.phishingDomains.length} phishing domains.`); } else { fs.writeFileSync(filePath, '[]', 'utf8'); console.log('[DB] Created phishing_domains.json.'); } } catch (error) { console.error('[DB] Error loading phishing_domains.json:', error); } }
function loadOrders() { loadArrayStateFromFile(client.orders, 'orders.json'); }
function loadAffiliates() { loadStateFromFile(client.affiliates, 'affiliates.json'); }
function saveGiveaways() { saveStateToFile(client.giveaways, 'giveaways.json'); }
function loadGiveaways() { loadStateFromFile(client.giveaways, 'giveaways.json'); }
function loadProducts() { loadArrayStateFromFile(client.products, 'products.json'); }
function loadSettings() { const filePath = path.join(__dirname, 'settings.json'); try { if (fs.existsSync(filePath)) { Object.assign(client.settings, JSON.parse(fs.readFileSync(filePath, 'utf8'))); console.log(`[DB] Loaded settings.`); } else { fs.writeFileSync(filePath, '{}', 'utf8'); console.log('[DB] Created settings.json.'); } } catch (error) { console.error('[DB] Error loading settings.json:', error); } }
function detectPhishing(content) { const urls = content.match(/(https?:\/\/[^\s]+)/gi) || []; return urls.some(url => client.security.config.phishingDomains.some(domain => url.toLowerCase().includes(domain))); }
function detectDangerousFile(attachments) { return attachments.some(att => client.security.config.dangerousExtensions.some(ext => att.name.toLowerCase().endsWith(ext))); }
function detectSpam(userId, channelId) { const key = `${userId}-${channelId}`; const now = Date.now(); const userMessages = client.messageTracker.get(key) || []; const recentMessages = userMessages.filter(time => now - time < client.security.config.spamTimeWindow); recentMessages.push(now); client.messageTracker.set(key, recentMessages); return recentMessages.length >= client.security.config.spamThreshold; }
async function handleViolation(message, type, reason) { /* Full implementation */ }
function addWarning(userId, type) { const userWarnings = warnings.get(userId) || {}; userWarnings[type] = (userWarnings[type] || 0) + 1; warnings.set(userId, userWarnings); saveStateToFile(warnings, 'warnings.json'); return userWarnings[type]; }
function trackViolation(userId, type, details) { const timestamp = new Date().toISOString(); const userHistory = violationHistory.get(userId) || []; userHistory.push({ type, timestamp, details }); violationHistory.set(userId, userHistory); saveStateToFile(violationHistory, 'violation_history.json'); }

// =================================================================
// SECTION 8: BOT LOGIN
// =================================================================
client.login(process.env.DISCORD_TOKEN);
