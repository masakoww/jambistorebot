const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Shows the top affiliate performers within a specified timeframe.')
        .addStringOption(option => option.setName('from').setDescription('Start date (YYYY-MM-DD)').setRequired(false))
        .addStringOption(option => option.setName('to').setDescription('End date (YYYY-MM-DD)').setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        const { affiliates, orders } = interaction.client;

        const fromDateStr = interaction.options.getString('from');
        const toDateStr = interaction.options.getString('to');

        let fromDate, toDate;
        let isTimeframed = false;

        if (fromDateStr && toDateStr) {
            fromDate = new Date(fromDateStr);
            toDate = new Date(toDateStr);
            toDate.setHours(23, 59, 59, 999);

            if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                return interaction.editReply('Invalid date format. Please use YYYY-MM-DD.');
            }
            isTimeframed = true;
        }

        if (affiliates.size === 0) {
            return interaction.editReply({ content: 'There are no affiliates yet.' });
        }

        // Calculate stats for each affiliate
        const affiliateStats = Array.from(affiliates.values()).map(aff => {
            const relevantOrders = orders.filter(order => {
                const orderIsRelevant = order.status === 'completed' && order.affiliateCode === aff.code;
                if (!isTimeframed) return orderIsRelevant;
                
                const orderDate = new Date(order.closedAt);
                return orderIsRelevant && orderDate >= fromDate && orderDate <= toDate;
            });

            return {
                username: aff.username,
                referralCount: relevantOrders.length
            };
        });

        const sortedAffiliates = affiliateStats.sort((a, b) => b.referralCount - a.referralCount);
        const top10 = sortedAffiliates.slice(0, 10);

        const description = top10.length > 0 ? top10.map((aff, index) => {
            return `**${index + 1}.** ${aff.username} - **${aff.referralCount}** referrals`;
        }).join('\n') : 'No referrals found in this period.';

        const embed = new EmbedBuilder()
            .setColor('#A020F0')
            .setTitle(`🏆 Affiliate Leaderboard`)
            .setDescription(description)
            .setTimestamp();
        
        if (isTimeframed) {
            embed.setFooter({ text: `Showing results from ${fromDate.toDateString()} to ${toDate.toDateString()}` });
        } else {
            embed.setFooter({ text: 'Showing all-time results' });
        }

        await interaction.editReply({ embeds: [embed] });
    },
};