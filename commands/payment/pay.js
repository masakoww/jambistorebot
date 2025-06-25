const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Single payment method configuration
const paymentConfig = {
    name: 'Payment Portal',
    icon: '💳',
    link: 'https://sociabuzz.com/fazkodisko', // Replace with your actual payment link
    description: 'Complete your payment securely through our payment portal'
};

function createPaymentEmbed(orderData = null) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`${paymentConfig.icon} Payment Required`)
        .setDescription(`**${paymentConfig.description}**\n\nClick the button below to proceed with your payment securely.`)
        .setTimestamp()
        .setFooter({ text: 'Complete your payment and send proof in this ticket' });

    if (orderData) {
        embed.addFields(
            {
                name: '📦 Order Summary',
                value: `**Product:** ${orderData.productName}\n**Quantity:** ${orderData.quantity}\n**Total:** Rp ${orderData.finalPrice.toLocaleString('id-ID')}`,
                inline: false
            }
        );
    }

    embed.addFields({
        name: '📋 Payment Instructions',
        value: '1️⃣ Click the "Pay Now" button below\n2️⃣ Complete your payment on the secure portal\n3️⃣ Send proof of payment in this ticket\n4️⃣ Wait for staff verification',
        inline: false
    });

    embed.addFields({
        name: '⚠️ Important Notes',
        value: '• Keep your payment receipt for records\n• Payment link is secure and encrypted\n• Contact staff if you encounter any issues\n• Do not share payment details with others',
        inline: false
    });

    return embed;
}

function createPaymentButton() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Pay Now')
            .setEmoji('💳')
            .setStyle(ButtonStyle.Link)
            .setURL(paymentConfig.link)
    );
}

module.exports = {
    name: 'pay',
    description: 'Displays payment method with secure payment link.',
    execute(message, args) {
        if (!message.channel.name.startsWith('ticket-')) {
            return message.reply('❌ This command can only be used in ticket channels.');
        }

        // Get order data from pending orders if available
        const { pendingOrders } = message.client;
        const orderData = pendingOrders?.get(message.channel.id);

        const paymentEmbed = createPaymentEmbed(orderData);
        const paymentButton = createPaymentButton();

        return message.reply({ 
            embeds: [paymentEmbed], 
            components: [paymentButton] 
        });
    },

    // Export the helper functions for potential reuse
    paymentConfig,
    createPaymentEmbed,
    createPaymentButton
};