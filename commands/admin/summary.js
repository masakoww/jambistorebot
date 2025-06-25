const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('summary')
        .setDescription('[Admin] Shows a sales summary for a given timeframe.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option => option.setName('from').setDescription('Start date (YYYY-MM-DD)').setRequired(true))
        .addStringOption(option => option.setName('to').setDescription('End date (YYYY-MM-DD)').setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const fromDate = new Date(interaction.options.getString('from'));
        const toDate = new Date(interaction.options.getString('to'));
        toDate.setHours(23, 59, 59, 999); // Include the whole end day

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            return interaction.editReply('Invalid date format. Please use YYYY-MM-DD.');
        }

        const { orders } = interaction.client;
        const filteredOrders = orders.filter(order => {
            const orderDate = new Date(order.closedAt);
            return order.status === 'completed' && orderDate >= fromDate && orderDate <= toDate;
        });

        const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.finalPrice, 0);
        const totalOrders = filteredOrders.length;

        const embed = new EmbedBuilder()
            .setColor('#4E74E9')
            .setTitle(`Sales Summary`)
            .setDescription(`Showing results from **${fromDate.toDateString()}** to **${toDate.toDateString()}**`)
            .addFields(
                { name: 'Total Completed Orders', value: `**${totalOrders}**`, inline: true },
                { name: 'Total Revenue', value: `**Rp ${totalRevenue.toLocaleString('id-ID')}**`, inline: true }
            )
            .setTimestamp();
            
        await interaction.editReply({ embeds: [embed] });
    },
};