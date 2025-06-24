const fs = require('node:fs');
const path = require('node:path');
const {
    Client, Collection, GatewayIntentBits, Events, Partials, PermissionsBitField,
    ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, ActivityType
} = require('discord.js');
require('dotenv').config();

// =================================================================
// SECTION 1: CONFIGURATION AND STATE MANAGEMENT
// =================================================================

const PREFIX = '!';
const AFFILIATE_DISCOUNT_RATE = 0.05;

const securityConfig = { logChannelId: process.env.LOG_CHANNEL_ID, authorizedUsers: process.env.AUTHORIZED_USERS ? process.env.AUTHORIZED_USERS.split(',') : [], phishingDomains: [], dangerousExtensions: ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar'], spamThreshold: 5, spamTimeWindow: 5000, warningLimit: 3, timeoutDuration: 3600000 };
const feedbackConfig = { testimonialChannelId: process.env.TESTIMONIAL_CHANNEL_ID, feedbackLogChannelId: process.env.FEEDBACK_LOG_CHANNEL_ID };
const commissionTiers = { 0: 0.02, 100: 0.05, 500: 0.07, 1000: 0.10 };

const warnings = new Map();
const violationHistory = new Map();
const messageTracker = new Map();
const ticketOwners = new Map();
const orders = [];
const pendingOrders = new Map();
const affiliates = new Map();
const giveaways = new Map();
const products = [];
const purchaseState = new Map();

// =================================================================
// SECTION 2: DISCORD CLIENT SETUP
// =================================================================

const client = new Client({
    intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration ],
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
client.giveaways = giveaways;
client.products = products;
client.purchaseState = purchaseState;

// =================================================================
// SECTION 3: COMMAND AND EVENT HANDLER REGISTRATION
// =================================================================

// --- Load Slash Commands (Corrected Logic) ---
const commandsPath = path.join(__dirname, 'commands');
function findAndLoadCommands(directory) {
    const items = fs.readdirSync(directory);
    for (const item of items) {
        const itemPath = path.join(directory, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
            findAndLoadCommands(itemPath); // Recurse into all subdirectories
        } else if (item.endsWith('.js') && directory !== path.join(__dirname, 'commands', 'payment')) {
            // Load file if it's a .js file AND not in the payment directory
            const command = require(itemPath);
            if ('data' in command && 'execute' in command) {
                command.filePath = itemPath;
                client.commands.set(command.data.name, command);
            }
        }
    }
}
findAndLoadCommands(commandsPath);


// --- Load Prefix Commands ---
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
    loadOrders();
    loadAffiliates();
    loadGiveaways();
    loadProducts();
    setInterval(checkGiveaways, 15 * 1000);
}

async function onInteractionCreate(interaction) {
    if (interaction.isChatInputCommand()) await handleSlashCommand(interaction);
    else if (interaction.isButton()) await handleButton(interaction);
    else if (interaction.isModalSubmit()) await handleModal(interaction);
    else if (interaction.isAutocomplete()) await handleAutocomplete(interaction);
}

async function onMessageCreate(message) {
    if (message.content.startsWith(PREFIX) && !message.author.bot) {
        await handlePrefixCommand(message);
        return;
    }
    if (message.author.bot || !message.guild || securityConfig.authorizedUsers.includes(message.author.id)) return;
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

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'An error occurred while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'An error occurred while executing this command!', ephemeral: true });
        }
    }
}

async function handleButton(interaction) {
    const { customId } = interaction;
    try {
        if (customId.startsWith('giveaway_enter')) await handleGiveawayEntry(interaction);
        else if (customId.startsWith('purchase_initiate')) await handlePurchaseInitiation(interaction);
        else if (customId === 'purchase_confirm_ticket') await handlePurchaseConfirmation(interaction);
        else if (customId === 'purchase_redeem_code') await handleRedeemButton(interaction);
        else if (customId === 'purchase_cancel') await interaction.update({ content: 'Purchase cancelled.', components: [], embeds: [] });
        else if (customId.startsWith('feedback_leave_review')) await handleFeedbackLeaveReviewClick(interaction);
        else if (customId.startsWith('feedback_no_thanks')) await interaction.update({ content: 'Thank you for your time.', components: [] });
    } catch (error) { console.error(`Error handling button ${customId}:`, error); }
}

async function handleModal(interaction) {
    const { customId } = interaction;
    try {
        if (customId.startsWith('purchase_form')) await handlePurchaseFormSubmit(interaction);
        else if (customId.startsWith('feedback_review_modal')) await handleFeedbackModalSubmit(interaction);
    } catch (error) { console.error(`Error handling modal ${customId}:`, error); }
}

async function handleSelectMenu(interaction) {
    const { customId } = interaction;
    try {
        if (customId === 'shop_purchase_select') await handleProductSelection(interaction);
    } catch (error) { console.error(`Error handling select menu ${customId}:`, error); }
}

async function handleAutocomplete(interaction) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;
    try {
        await command.autocomplete(interaction);
    } catch (error) { console.error('Autocomplete error:', error); }
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
    try {
        command.execute(message, args);
    } catch (error) {
        console.error(`Error executing prefix command ${commandName}:`, error);
        message.reply('There was an error executing that command!');
    }
}

// =================================================================
// SECTION 6: CORE BOT FEATURE LOGIC
// =================================================================

// --- E-commerce System ---
async function handlePurchaseInitiation(interaction) {
    const productId = interaction.customId.split('_')[2];
    const product = products.find(p => p.id === productId);
    if (!product || product.stock < 1) {
        return interaction.reply({ content: 'This item is out of stock or no longer available.', ephemeral: true });
    }

    const modal = new ModalBuilder()
        .setCustomId(`purchase_form_${productId}`)
        .setTitle(`Purchase: ${product.name}`);
        
    const quantityInput = new TextInputBuilder().setCustomId('quantity').setLabel(`Quantity (Max: ${product.stock})`).setStyle(TextInputStyle.Short).setRequired(true);
    const affiliateInput = new TextInputBuilder().setCustomId('affiliate_code').setLabel("Affiliate Code (Optional)").setStyle(TextInputStyle.Short).setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(quantityInput), new ActionRowBuilder().addComponents(affiliateInput));
    await interaction.showModal(modal);
}

async function handlePurchaseFormSubmit(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const productId = interaction.customId.split('_')[2];
    const product = products.find(p => p.id === productId);

    if (!product) {
        return interaction.editReply({ content: 'The product could not be found. It may have been removed.' });
    }

    const quantity = parseInt(interaction.fields.getTextInputValue('quantity'), 10);
    const affiliateCode = interaction.fields.getTextInputValue('affiliate_code')?.toLowerCase();

    if (isNaN(quantity) || quantity < 1 || quantity > product.stock) {
        return interaction.editReply({ content: `Invalid quantity. Please enter a number between 1 and ${product.stock}.` });
    }

    let finalPrice = product.price * quantity;
    let discountApplied = 0;
    let validAffiliate = null;

    if (affiliateCode) {
        validAffiliate = Array.from(affiliates.values()).find(aff => aff.code.toLowerCase() === affiliateCode);
        if (validAffiliate && validAffiliate.userId !== interaction.user.id) {
            discountApplied = finalPrice * AFFILIATE_DISCOUNT_RATE;
            finalPrice -= discountApplied;
        } else {
            validAffiliate = null;
        }
    }

    const ticketChannel = await createTicketChannel(interaction.guild, interaction.user);
    const pendingOrderData = {
        orderId: ticketChannel.id, timestamp: new Date().toISOString(), userId: interaction.user.id, username: interaction.user.username,
        productName: product.name, productId: product.id,
        pricePerUnit: product.price, quantity,
        initialPrice: product.price * quantity,
        discount: discountApplied,
        finalPrice,
        affiliateCode: validAffiliate ? validAffiliate.code : null,
        status: 'pending'
    };

    pendingOrders.set(ticketChannel.id, pendingOrderData);
    ticketOwners.set(ticketChannel.id, interaction.user.id);
    await sendTicketWelcomeMessage(ticketChannel, interaction.user, pendingOrderData);
    
    purchaseState.delete(interaction.user.id);
    await interaction.editReply({ content: `✅ Ticket created successfully: ${ticketChannel}` });
}

async function sendTicketWelcomeMessage(channel, user, orderData) {
    const supportRole = channel.guild.roles.cache.find(r => r.name === 'SELLER');
    const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('🛒 Final Order Summary')
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .addFields(
            { name: '📦 Product', value: `\`${orderData.productName}\``, inline: true },
            { name: '🔢 Quantity', value: `\`${orderData.quantity}\``, inline: true },
            { name: '💰 Final Price', value: `**Rp ${orderData.finalPrice.toLocaleString('id-ID')}**`, inline: true }
        );
    if(orderData.affiliateCode) {
        embed.addFields({ name: '🤝 Affiliate Code Used', value: `\`${orderData.affiliateCode}\` (-Rp ${orderData.discount.toLocaleString('id-ID')})`});
    }
    embed.setFooter({ text: 'An admin will be with you shortly to provide payment details.' });
    
    await channel.send({ content: `${user} ${supportRole || ''}`, embeds: [embed] });
}

async function createTicketChannel(guild, user) {
    const supportRole = guild.roles.cache.find(r => r.name === 'SELLER');
    let ticketCategory = guild.channels.cache.find(c => c.name === "TICKETS" && c.type === ChannelType.GuildCategory);
    if (!ticketCategory) ticketCategory = await guild.channels.create({ name: 'TICKETS', type: ChannelType.GuildCategory });
    const permissionOverwrites = [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }, { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }];
    if (supportRole) permissionOverwrites.push({ id: supportRole.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages] });
    return await guild.channels.create({ name: `ticket-${user.username}`, type: ChannelType.GuildText, parent: ticketCategory.id, permissionOverwrites });
}

// --- Giveaway System ---
async function handleGiveawayEntry(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const messageId = interaction.customId.split('_')[2];
    const giveaway = giveaways.get(messageId);
    if (!giveaway || giveaway.status === 'ended') {
        return interaction.editReply({ content: 'This giveaway is invalid or has already ended.' });
    }
    if (giveaway.participants.includes(interaction.user.id)) {
        return interaction.editReply({ content: 'You have already entered this giveaway!' });
    }
    giveaway.participants.push(interaction.user.id);
    giveaways.set(messageId, giveaway);
    saveGiveaways();
    await interaction.editReply({ content: 'You have successfully entered the giveaway!' });
}

async function checkGiveaways() {
    const now = Date.now();
    for (const [messageId, giveaway] of giveaways.entries()) {
        if (giveaway.status === 'running' && giveaway.endTime <= now) {
            await endGiveaway(messageId, giveaway);
        }
    }
}

async function endGiveaway(messageId, giveaway) {
    console.log(`Ending giveaway: ${messageId}`);
    giveaway.status = 'ended';

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) {
        console.error(`Giveaway channel ${giveaway.channelId} not found.`);
        giveaways.set(messageId, giveaway);
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
    giveaways.set(messageId, giveaway);
    saveGiveaways();
    
    if (message) {
        const embed = new EmbedBuilder(message.embeds[0].data)
            .setColor('#DC143C').setTitle(`🎉 GIVEAWAY ENDED 🎉`)
            .setDescription(`This giveaway for **${giveaway.prize}** has ended.\n\nWinners: ${winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'No one entered!'}`);
        const newButton = new ButtonBuilder().setCustomId(`giveaway_ended_${messageId}`).setLabel('Giveaway Ended').setStyle(ButtonStyle.Secondary).setDisabled(true);
        await message.edit({ embeds: [embed], components: [new ActionRowBuilder().addComponents(newButton)] });
    }

    if (winners.length > 0) {
        await channel.send({ content: `Congratulations ${winners.map(w => `<@${w}>`).join(', ')}! You won the **${giveaway.prize}**!`, allowedMentions: { users: winners } });
    } else {
        await channel.send({ content: `The giveaway for **${giveaway.prize}** has ended with no participants.` });
    }
}


// --- Feedback System ---
async function handleFeedbackLeaveReviewClick(interaction) {
    const modal = new ModalBuilder().setCustomId('feedback_review_modal').setTitle('Leave Your Feedback');
    const ratingInput = new TextInputBuilder().setCustomId('rating').setLabel("Rating (1-5)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(1);
    const reviewInput = new TextInputBuilder().setCustomId('review').setLabel("Review Comments").setStyle(TextInputStyle.Paragraph).setRequired(false);
    modal.addComponents(new ActionRowBuilder().addComponents(ratingInput), new ActionRowBuilder().addComponents(reviewInput));
    await interaction.showModal(modal);
}

async function handleFeedbackModalSubmit(interaction) {
    await interaction.deferUpdate();
    const rating = interaction.fields.getTextInputValue('rating');
    const review = interaction.fields.getTextInputValue('review') || 'No comments.';
    if (isNaN(rating) || Number(rating) < 1 || Number(rating) > 5) return interaction.followUp({ content: 'Invalid rating. Please enter 1-5.', ephemeral: true });
    const logChannel = interaction.client.channels.cache.get(feedbackConfig.feedbackLogChannelId);
    if (logChannel) {
        const stars = '⭐'.repeat(Number(rating)) + '✩'.repeat(5 - Number(rating));
        const embed = new EmbedBuilder().setColor('#FFD700').setTitle('New Customer Feedback').setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() }).addFields({ name: 'Rating', value: stars }, { name: 'Review', value: `\`\`\`${review}\`\`\`` });
        await logChannel.send({ embeds: [embed] });
    }
    await interaction.editReply({ content: 'Thank you for your feedback!', components: [] });
}

// =================================================================
// SECTION 7: DATA PERSISTENCE AND SECURITY
// =================================================================
function saveStateToFile(data, fileName) { try { const dataToSave = data instanceof Map ? Object.fromEntries(data) : data; fs.writeFileSync(path.join(__dirname, fileName), JSON.stringify(dataToSave, null, 2)); } catch (error) { console.error(`[DB] Error saving ${fileName}:`, error); } }
function loadStateFromFile(map, fileName) { const filePath = path.join(__dirname, fileName); try { if (fs.existsSync(filePath)) { const data = fs.readFileSync(filePath, 'utf8'); Object.entries(JSON.parse(data)).forEach(([key, value]) => map.set(key, value)); console.log(`[DB] Loaded data from ${fileName}.`); } } catch (error) { console.error(`[DB] Error loading ${fileName}:`, error); } }
function loadPhishingDomains() { const filePath = path.join(__dirname, 'phishing_domains.json'); try { if (fs.existsSync(filePath)) { securityConfig.phishingDomains = JSON.parse(fs.readFileSync(filePath, 'utf8')); console.log(`[DB] Loaded ${securityConfig.phishingDomains.length} phishing domains.`); } else { fs.writeFileSync(filePath, '[]', 'utf8'); console.log('[DB] Created phishing_domains.json.'); } } catch (error) { console.error('[DB] Error loading phishing_domains.json:', error); } }
function loadOrders() { const filePath = path.join(__dirname, 'orders.json'); try { if (fs.existsSync(filePath)) { orders.push(...JSON.parse(fs.readFileSync(filePath, 'utf8'))); console.log(`[DB] Loaded ${orders.length} completed orders.`); } else { fs.writeFileSync(filePath, '[]', 'utf8'); console.log('[DB] Created orders.json.'); } } catch (error) { console.error('[DB] Error loading orders.json:', error); } }
function loadAffiliates() { const filePath = path.join(__dirname, 'affiliates.json'); try { if (fs.existsSync(filePath)) { Object.entries(JSON.parse(fs.readFileSync(filePath, 'utf8'))).forEach(([k, v]) => affiliates.set(k, v)); console.log(`[DB] Loaded ${affiliates.size} affiliates.`); } else { fs.writeFileSync(filePath, '{}', 'utf8'); console.log('[DB] Created affiliates.json.'); } } catch (error) { console.error('[DB] Error loading affiliates.json:', error); } }
function saveGiveaways() { saveStateToFile(giveaways, 'giveaways.json'); }
function loadGiveaways() { loadStateFromFile(giveaways, 'giveaways.json'); }
function loadProducts() { const filePath = path.join(__dirname, 'products.json'); try { if (fs.existsSync(filePath)) { products.splice(0, products.length, ...JSON.parse(fs.readFileSync(filePath, 'utf8'))); console.log(`[DB] Loaded ${products.length} products.`); } else { fs.writeFileSync(filePath, '[]', 'utf8'); console.log('[DB] Created products.json.'); } } catch (error) { console.error('[DB] Error loading products.json:', error); } }
function detectPhishing(content) { const urls = content.match(/(https?:\/\/[^\s]+)/gi) || []; return urls.some(url => securityConfig.phishingDomains.some(domain => url.toLowerCase().includes(domain))); }
function detectDangerousFile(attachments) { return attachments.some(att => securityConfig.dangerousExtensions.some(ext => att.name.toLowerCase().endsWith(ext))); }
function detectSpam(userId, channelId) { const key = `${userId}-${channelId}`; const now = Date.now(); const userMessages = messageTracker.get(key) || []; const recentMessages = userMessages.filter(time => now - time < securityConfig.spamTimeWindow); recentMessages.push(now); messageTracker.set(key, recentMessages); return recentMessages.length >= securityConfig.spamThreshold; }
async function handleViolation(message, type, reason) { /* ... full violation logic ... */ }

// =================================================================
// SECTION 8: BOT LOGIN
// =================================================================
client.login(process.env.DISCORD_TOKEN);