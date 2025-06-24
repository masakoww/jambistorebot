const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Shows the top affiliate performers.'),
    async execute(interaction) {
        const { affiliates } = interaction.client;

        if (affiliates.size === 0) {
            return interaction.reply({ content: 'There are no affiliates yet.', ephemeral: true });
        }

        // Sort affiliates by referral count
        const sortedAffiliates = Array.from(affiliates.values()).sort((a, b) => {
            const aCount = a.referrals?.length || 0;
            const bCount = b.referrals?.length || 0;
            return bCount - aCount;
        });

        const top10 = sortedAffiliates.slice(0, 10);

        const description = top10.map((aff, index) => {
            const rank = index + 1;
            const userTag = aff.username || `User ID: ${aff.userId}`;
            const referralCount = aff.referrals?.length || 0;
            return `**${rank}.** ${userTag} - **${referralCount}** referrals`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#A020F0')
            .setTitle('🏆 Affiliate Leaderboard')
            .setDescription(description || 'The leaderboard is empty.')
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};