const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

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
        const { pendingOrders, orders, ticketOwners, affiliates, products } = interaction.client;
        const pendingOrderData = pendingOrders.get(channel.id);

        if (status === 'done') {
            if (pendingOrderData) {
                // --- STOCK DECREMENT LOGIC ---
                const productIndex = products.findIndex(p => p.id === pendingOrderData.productId);
                if (productIndex !== -1) {
                    const product = products[productIndex];
                    product.stock -= pendingOrderData.quantity;

                    const productsPath = path.join(__dirname, '../../products.json');
                    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));

                    try {
                        const shopChannel = await interaction.client.channels.fetch(product.channelId);
                        const shopMessage = await shopChannel.messages.fetch(product.messageId);
                        const oldEmbed = shopMessage.embeds[0];

                        const newEmbed = EmbedBuilder.from(oldEmbed)
                            .setFields(
                                { name: 'Harga', value: `Rp ${product.price.toLocaleString('id-ID')}`, inline: true },
                                { name: 'Stok', value: `${product.stock}`, inline: true }
                            );
                        
                        const oldButton = shopMessage.components[0].components[0];
                        const newButton = ButtonBuilder.from(oldButton).setDisabled(product.stock <= 0);
                        const newRow = new ActionRowBuilder().addComponents(newButton);

                        await shopMessage.edit({ embeds: [newEmbed], components: [newRow] });
                    } catch(e) {
                        console.error("Could not update the original shop message.", e);
                    }
                }
                
                // --- Finalize and Log Order ---
                const finalOrder = { ...pendingOrderData, status: 'completed', closedAt: new Date().toISOString() };
                orders.push(finalOrder);
                fs.writeFileSync(path.join(__dirname, '../../orders.json'), JSON.stringify(orders, null, 2));

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
                
                // --- DM User for Feedback ---
                const ownerId = ticketOwners.get(channel.id);
                if (ownerId) {
                    try {
                        const owner = await interaction.client.users.fetch(ownerId);
                        const embed = new EmbedBuilder().setColor('#3498DB').setTitle('Your Order is Complete!').setDescription(`Thank you for your purchase from **${interaction.guild.name}**! We'd love your feedback.`);
                        const buttons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('feedback_leave_review').setLabel('Leave Review').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('feedback_no_thanks').setLabel('No, Thanks').setStyle(ButtonStyle.Secondary)
                        );
                        await owner.send({ embeds: [embed], components: [buttons] });
                    } catch (err) {
                        console.log(`Could not DM user ${ownerId}. They may have DMs disabled.`);
                    }
                }

                await interaction.editReply({ content: '✅ This ticket has been marked as **Done**. Stock has been updated, the order logged, and a feedback request sent. The channel will be deleted in 10 seconds.' });

            } else {
                await interaction.editReply({ content: '⚠️ Could not find pending order data for this ticket. Closing without logging.', ephemeral: true });
            }
        } else { // status === 'cancelled'
            await interaction.editReply({ content: '❌ This ticket has been marked as **Cancelled**. No order will be logged. The channel will be deleted in 10 seconds.' });
        }

        // Cleanup maps and delete channel
        pendingOrders.delete(channel.id);
        ticketOwners.delete(channel.id);

        setTimeout(() => {
            channel.delete(`Ticket closed with status: ${status}`).catch(error => console.error(`Could not delete ticket channel ${channel.id}:`, error));
        }, 10000);
    },
};