const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Helper function to generate an HTML transcript
async function generateTranscript(channel) {
    let transcriptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Ticket Transcript</title>
            <style>
                body { background-color: #36393f; color: #dcddde; font-family: 'Whitney', 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; }
                .message { display: flex; margin-bottom: 15px; }
                .avatar { width: 40px; height: 40px; border-radius: 50%; margin-right: 15px; }
                .message-content { display: flex; flex-direction: column; }
                .user-info { font-weight: bold; margin-bottom: 5px; }
                .user-info .timestamp { font-size: 0.75em; color: #72767d; font-weight: normal; margin-left: 10px; }
                .message-text { line-height: 1.3; }
                .embed { border-left: 4px solid #4f545c; padding: 10px; background-color: #2f3136; border-radius: 4px; margin-top: 5px; }
                .embed-title { font-weight: bold; margin-bottom: 5px; }
            </style>
        </head>
        <body>
            <h1>Transcript for Ticket: #${channel.name}</h1>
    `;

    const messages = await channel.messages.fetch({ limit: 100 });
    const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const msg of sortedMessages) {
        const userAvatar = msg.author.displayAvatarURL();
        const userName = msg.author.username;
        const timestamp = msg.createdAt.toLocaleString('en-US', { timeZone: 'UTC' });
        
        transcriptHTML += `
            <div class="message">
                <img src="${userAvatar}" class="avatar">
                <div class="message-content">
                    <div class="user-info">${userName} <span class="timestamp">${timestamp} UTC</span></div>
                    <div class="message-text">${msg.content || ''}</div>
        `;
        
        // Handle embeds
        if (msg.embeds.length > 0) {
            for (const embed of msg.embeds) {
                transcriptHTML += `<div class="embed">`;
                if(embed.title) transcriptHTML += `<div class="embed-title">${embed.title}</div>`;
                if(embed.description) transcriptHTML += `<div>${embed.description}</div>`;
                // You can add more embed fields here if needed
                transcriptHTML += `</div>`;
            }
        }
        
        transcriptHTML += `</div></div>`;
    }

    transcriptHTML += `</body></html>`;
    return transcriptHTML;
}

// Helper function to log the completed order to a channel
async function logOrderToChannel(client, order, adminUser) { /* ... same as before ... */ }

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
        const ownerId = ticketOwners.get(channel.id);

        if (status === 'done' && pendingOrderData) {
            // --- NEW: Generate Transcript FIRST ---
            const transcriptHTML = await generateTranscript(channel);
            const transcriptBuffer = Buffer.from(transcriptHTML, 'utf-8');
            const transcriptAttachment = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${channel.id}.html` });
            
            // --- DM User with Transcript and Feedback Request ---
            if (ownerId) {
                try {
                    const owner = await interaction.client.users.fetch(ownerId);
                    const embed = new EmbedBuilder().setColor('#3498DB').setTitle('Your Order is Complete!').setDescription(`Thank you for your purchase! A transcript of your ticket is attached for your records.\n\nWe would also love your feedback on the product.`);
                    const buttons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`feedback_leave_review_${pendingOrderData.productId}`).setLabel('⭐RATING KAMI').setStyle(ButtonStyle.Success)
                        //, new ButtonBuilder().setCustomId('feedback_no_thanks').setLabel('No, Thanks').setStyle(ButtonStyle.Secondary) Tidak perlu
                    );
                    
                    await owner.send({ embeds: [embed], files: [transcriptAttachment], components: [buttons] });
                } catch (err) {
                    console.log(`Could not DM user ${ownerId}. They may have DMs disabled.`);
                }
            }

            // --- Update Stock, Log Order, Credit Affiliate (Existing Logic) ---
            const productIndex = products.findIndex(p => p.id === pendingOrderData.productId);
            if (productIndex !== -1) { /* ... stock update logic ... */ }
            const finalOrder = { ...pendingOrderData, status: 'completed', closedAt: new Date().toISOString() };
            orders.push(finalOrder);
            fs.writeFileSync(path.join(__dirname, '../../orders.json'), JSON.stringify(orders, null, 2));
            if (finalOrder.affiliateCode) { /* ... affiliate logic ... */ }
            await logOrderToChannel(interaction.client, finalOrder, interaction.user);

            await interaction.editReply({ content: '✅ This ticket has been marked as **Done**. A transcript has been sent to the user, the order logged, and stock updated. The channel will be deleted in 10 seconds.' });

        } else {
            await interaction.editReply({ content: '❌ This ticket has been marked as **Cancelled**. No order will be logged. The channel will be deleted in 10 seconds.' });
        }

        pendingOrders.delete(channel.id);
        ticketOwners.delete(channel.id);

        setTimeout(() => {
            channel.delete(`Ticket closed with status: ${status}`).catch(error => console.error(`Could not delete ticket channel ${channel.id}:`, error));
        }, 10000);
    },
};