const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkorder')
        .setDescription('Check the details of a specific completed order by ID.')
        .addStringOption(option => option.setName('id').setDescription('The Order ID to check.').setRequired(true)),
    async execute(interaction) {
        const orderId = interaction.options.getString('id');
        const order = interaction.client.orders.find(o => o.orderId === orderId);

        if (!order) {
            return interaction.reply({ content: 'No completed order with that ID was found.', ephemeral: true });
        }

        // For privacy/security, only the original buyer or an admin can check an order.
        const isBuyer = interaction.user.id === order.userId;
        const isAdmin = interaction.member.permissions.has('ManageChannels'); // Simple admin check

        if (!isBuyer && !isAdmin) {
            return interaction.reply({ content: "You do not have permission to view this order's details.", ephemeral: true });
        }

        const buyer = await interaction.client.users.fetch(order.userId).catch(() => ({ tag: 'Unknown User' }));

        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle(`Details for Order ID: ${order.orderId}`)
            .addFields(
                { name: 'Product', value: order.productName },
                { name: 'Buyer', value: buyer.tag, inline: true },
                { name: 'Quantity', value: `${order.quantity}`, inline: true },
                { name: 'Final Price', value: `Rp ${order.finalPrice.toLocaleString('id-ID')}`, inline: true },
                { name: 'Date Completed', value: `<t:${Math.floor(new Date(order.closedAt).getTime() / 1000)}:F>` },
                { name: 'Affiliate Code Used', value: order.affiliateCode || 'None' }
            )
            .setTimestamp();
            
        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};