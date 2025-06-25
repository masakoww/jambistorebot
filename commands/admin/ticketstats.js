const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('ticketstats')
        .setDescription('[Admin] Shows statistics about tickets.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const { orders } = interaction.client;
        
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentOrders = orders.filter(o => new Date(o.timestamp).getTime() > thirtyDaysAgo);

        const completed = recentOrders.filter(o => o.status === 'completed').length;
        const cancelled = recentOrders.filter(o => o.status === 'cancelled').length;
        const total = completed + cancelled;

        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('📊 Ticket Stats (Last 30 Days)')
            .addFields(
                { name: 'Total Opened', value: `\`${total}\``, inline: true },
                { name: '✅ Completed', value: `\`${completed}\``, inline: true },
                { name: '❌ Cancelled', value: `\`${cancelled}\``, inline: true }
            )
            .setFooter({ text: 'This includes all tickets, successful or not.' });

        await interaction.editReply({ embeds: [embed] });
    }
};