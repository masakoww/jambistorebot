const { SlashCommandBuilder, PermissionsBitField, AttachmentBuilder } = require('discord.js');

module.exports = {
    isSecurityCommand: true,
    data: new SlashCommandBuilder()
        .setName('export')
        .setDescription('[Admin] Exports all completed order data as a CSV file.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const orders = interaction.client.orders;
        if (!orders || orders.length === 0) {
            return interaction.editReply({ content: 'There are no completed orders to export.' });
        }

        // UPDATED: Added Price to headers
        const headers = ['OrderID', 'Timestamp', 'UserID', 'Username', 'Product', 'Price', 'Duration', 'Quantity', 'Payment', 'Notes', 'AffiliateCode', 'Status', 'ClosedAt'];
        const rows = orders.map(order => [
            order.orderId, order.timestamp, order.userId, order.username,
            order.productName, order.price, order.duration, order.quantity,
            order.paymentMethod, order.notes, order.affiliateCode || 'N/A',
            order.status, order.closedAt
        ].join(','));
        const csvContent = [headers.join(','), ...rows].join('\n');
        const buffer = Buffer.from(csvContent, 'utf-8');
        const attachment = new AttachmentBuilder(buffer, { name: 'orders_export.csv' });
        await interaction.editReply({ content: `Export of ${orders.length} completed orders.`, files: [attachment] });
    },
};