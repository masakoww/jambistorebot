const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Generates a styled HTML string from the messages in a channel.
 * @param {import('discord.js').TextChannel} channel The channel to create a transcript of.
 * @returns {Promise<string>} A promise that resolves with the HTML content.
 */
async function generateTranscript(channel) {
    let html = `<!DOCTYPE html><html><head><title>Ticket Transcript: ${channel.name}</title><meta charset="utf-8"><style>body{background-color:#36393f;color:#dcddde;font-family:'Whitney',sans-serif;padding:20px}.message-group{margin-bottom:20px;display:flex}.avatar{width:40px;height:40px;border-radius:50%;margin-right:15px}.message-content{flex-grow:1}.user-info{font-weight:bold;color:#fff;margin-bottom:4px}.timestamp{font-size:.75em;color:#72767d;margin-left:8px}.message-text{line-height:1.4;white-space:pre-wrap;word-wrap:break-word}.embed{border-left:4px solid #4f545c;padding:10px;background-color:#2f3136;border-radius:4px;margin-top:5px}</style></head><body><h1>Transcript for Ticket: #${channel.name}</h1>`;
    const messages = await channel.messages.fetch({ limit: 100 });
    const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    for (const msg of sortedMessages) {
        const userAvatar = msg.author.displayAvatarURL();
        const userName = msg.author.tag;
        const timestamp = msg.createdAt.toLocaleString('en-US', { timeZone: 'UTC' });
        html += `<div class="message-group"><img src="${userAvatar}" class="avatar"><div class="message-content"><div class="user-info">${userName}<span class="timestamp">${timestamp} UTC</span></div>`;
        if (msg.content) html += `<div class="message-text">${msg.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
        if (msg.embeds.length > 0) {
            for (const embed of msg.embeds) {
                html += `<div class="embed"><strong>${embed.title || 'Embed'}</strong><br>${embed.description ? embed.description.replace(/\n/g, "<br>") : ''}</div>`;
            }
        }
        html += `</div></div>`;
    }
    html += `</body></html>`;
    return html;
}

/**
 * Sends a log of the completed order to a specified channel.
 * @param {import('discord.js').Client} client The Discord client instance.
 * @param {object} order The finalized order object.
 * @param {import('discord.js').User} adminUser The admin who closed the ticket.
 */
async function logOrderToChannel(client, order, adminUser) {
    const logChannelId = client.orderLogConfig?.channelId;
    if (!logChannelId) return console.log("Warning: ORDER_LOG_CHANNEL_ID not set.");
    const logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel) return console.error(`Error: Could not find order log channel: ${logChannelId}`);

    const buyer = await client.users.fetch(order.userId).catch(() => ({ tag: 'Unknown User', id: order.userId }));
    const logEmbed = new EmbedBuilder().setColor('#57F287').setTitle('✅ Log Transaksi Baru').addFields({ name: 'Item Dibeli', value: `\`${order.productName}\`` }, { name: 'Jumlah', value: `\`${order.quantity}\``, inline: true }, { name: 'Harga Total', value: `\`Rp ${order.finalPrice.toLocaleString('id-ID')}\``, inline: true }, { name: 'Pembeli', value: `${buyer} (${buyer.id})` }, { name: 'Staff Bertugas', value: `${adminUser} (${adminUser.id})` }).setTimestamp();
    try { await logChannel.send({ embeds: [logEmbed] }); }
    catch (error) { console.error(`Failed to send to order log channel:`, error); }
}

function generateOrderId() {
    const d = new Date();
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${year}${month}${day}-${randomPart}`;
}

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('[Admin] Closes a ticket and finalizes the order status.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Was the transaction successful?')
                .setRequired(true)
                .addChoices(
                    { name: 'Done (Success)', value: 'done' },
                    { name: 'Cancelled (Failure)', value: 'cancelled' }
                )),
    async execute(interaction) {
        const channel = interaction.channel;
        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({ content: 'This command can only be used in a ticket channel.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const status = interaction.options.getString('status');
        const { pendingOrders, orders, ticketOwners, affiliates, products, settings } = interaction.client;
        const pendingOrderData = pendingOrders.get(channel.id);
        const ownerId = ticketOwners.get(channel.id);

        if (status === 'done' && pendingOrderData) {
            // Check if test mode is enabled
            if (settings?.testMode) {
                await interaction.editReply({ content: '✅ **TEST MODE:** Ticket marked as Done. No data was logged. Channel will be deleted.' });
            } else {
                // --- Generate Transcript ---
                const transcriptHTML = await generateTranscript(channel);
                const transcriptBuffer = Buffer.from(transcriptHTML, 'utf-8');
                const transcriptAttachment = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${channel.id}.html` });
                
                // --- Log Transcript to Channel ---
                const transcriptLogChannelId = process.env.TRANSCRIPT_LOG_CHANNEL_ID;
                if (transcriptLogChannelId) {
                    const transcriptLogChannel = interaction.client.channels.cache.get(transcriptLogChannelId);
                    if (transcriptLogChannel) {
                        try {
                            await transcriptLogChannel.send({ content: `Transcript for ticket \`#${channel.name}\` closed by ${interaction.user.tag}.`, files: [transcriptAttachment] });
                        } catch(e) { console.error("Failed to upload transcript to log channel:", e); }
                    }
                } else {
                     console.log("Warning: TRANSCRIPT_LOG_CHANNEL_ID not set in .env. Skipping transcript log.");
                }

                // --- Finalize Order ---
                const finalOrder = { 
                    ...pendingOrderData, 
                    orderId: generateOrderId(), // Use new user-friendly ID
                    status: 'completed', 
                    closedAt: new Date().toISOString() 
                };

                // Add the order to orders collection
                orders.push(finalOrder);
                
                // --- Update Stock & Listing ---
                const productIndex = products.findIndex(p => p.id === pendingOrderData.productId);
                if (productIndex !== -1) {
                    const product = products[productIndex];
                    const variantName = pendingOrderData.productName.split(' - ')[1];
                    const variantIndex = product.variants.findIndex(v => v.name === variantName);
                    
                    if (variantIndex !== -1) {
                        product.variants[variantIndex].stock -= pendingOrderData.quantity;
                    }
                    product.totalSold = (product.totalSold || 0) + pendingOrderData.quantity;

                    fs.writeFileSync(path.join(__dirname, '../../products.json'), JSON.stringify(products, null, 2));

                    try {
                        const shopChannel = await interaction.client.channels.fetch(product.channelId);
                        const shopMessage = await shopChannel.messages.fetch(product.messageId);
                        const newEmbed = EmbedBuilder.from(shopMessage.embeds[0]).setDescription(`${product.description}\n\n${product.variants.map(v => `> **${v.name}** - Rp ${v.price.toLocaleString('id-ID')} (Stok: ${v.stock})`).join('\n')}`);
                        const isOutOfStock = product.variants.every(v => v.stock <= 0);
                        const oldButton = shopMessage.components[0].components[0];
                        const newButton = ButtonBuilder.from(oldButton).setDisabled(isOutOfStock);
                        await shopMessage.edit({ embeds: [newEmbed], components: [new ActionRowBuilder().addComponents(newButton)] });
                    } catch(e) { console.error("Could not update the original shop message.", e); }
                }
                
                // --- Credit Affiliate ---
                if (finalOrder.affiliateCode) {
                    const affiliate = Array.from(affiliates.values()).find(aff => aff.code === finalOrder.affiliateCode);
                    if (affiliate) {
                        if (!affiliate.referrals) affiliate.referrals = [];
                        affiliate.referrals.push(finalOrder.orderId);
                        affiliates.set(affiliate.userId, affiliate);
                        fs.writeFileSync(path.join(__dirname, '../../affiliates.json'), JSON.stringify(Object.fromEntries(affiliates), null, 2));
                    }
                }
                
                // --- Log order to channel ---
                await logOrderToChannel(interaction.client, finalOrder, interaction.user);

                // --- "Trusted Buyer" Auto-Role ---
                if (ownerId) {
                    const completedOrdersCount = orders.filter(o => o.userId === ownerId && o.status === 'completed').length;
                    const threshold = parseInt(process.env.TRUSTED_BUYER_THRESHOLD, 10) || 10;
                    const roleId = process.env.TRUSTED_BUYER_ROLE_ID;
                    
                    if (roleId && completedOrdersCount >= threshold) {
                        try {
                            const member = await interaction.guild.members.fetch(ownerId);
                            if (!member.roles.cache.has(roleId)) {
                                await member.roles.add(roleId);
                                console.log(`Assigned Trusted Buyer role to ${member.user.tag} (${completedOrdersCount} completed orders)`);
                            }
                        } catch (e) {
                            console.error("Failed to assign Trusted Buyer role:", e);
                        }
                    }
                }

                // --- DM User with Invoice & Feedback Request ---
                if (ownerId) {
                    try {
                        const owner = await interaction.client.users.fetch(ownerId);
                        const invoiceEmbed = new EmbedBuilder().setColor('#5865F2').setTitle('Invoice & Order Complete').setDescription(`Here is a summary of your completed transaction.`).addFields({ name: 'Product', value: finalOrder.productName }, { name: 'Quantity', value: `${finalOrder.quantity}`, inline: true }, { name: 'Final Price', value: `Rp ${finalOrder.finalPrice.toLocaleString('id-ID')}`, inline: true }, { name: 'Order ID', value: `\`${finalOrder.orderId}\`` }).setTimestamp().setFooter({ text: `Thank you for your purchase from ${interaction.guild.name}!` });
                        
                        // We send the transcript again in the DM for user's convenience
                        const dmTranscriptAttachment = new AttachmentBuilder(Buffer.from(transcriptHTML, 'utf-8'), { name: `transcript-${channel.id}.html` });
                        await owner.send({ content: "Your order is complete! A full transcript is attached for your records.", embeds: [invoiceEmbed], files: [dmTranscriptAttachment] });
                        
                        const feedbackEmbed = new EmbedBuilder().setColor('#3498DB').setTitle('How was your experience?').setDescription(`We'd love your feedback on your purchase of **${finalOrder.productName}**.`);
                        const buttons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`feedback_leave_review_${finalOrder.productId}`).setLabel('Leave a Review').setStyle(ButtonStyle.Success)
                        );
                        await owner.send({ embeds: [feedbackEmbed], components: [buttons] });
                    } catch (err) {
                        console.log(`Could not DM user ${ownerId}. They may have DMs disabled.`);
                    }
                }

                await interaction.editReply({ content: '✅ Ticket marked as Done. All systems updated. Channel will be deleted.' });
            }
        } else {
            await interaction.editReply({ content: '❌ Ticket marked as Cancelled. Channel will be deleted.' });
        }

        pendingOrders.delete(channel.id);
        ticketOwners.delete(channel.id);
        setTimeout(() => {
            channel.delete(`Ticket closed with status: ${status}`).catch(error => console.error(`Could not delete ticket channel ${channel.id}:`, error));
        }, 10000);
    },
};