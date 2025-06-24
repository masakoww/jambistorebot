const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('myaffiliate')
        .setDescription('Check your current affiliate stats and earnings.'),
    async execute(interaction) {
        const { affiliates, orders, commissions } = interaction.client;
        const userId = interaction.user.id;

        const affiliateData = affiliates.get(userId);
        if (!affiliateData) {
            return interaction.reply({ content: 'You are not registered as an affiliate. Use `/daftar-affiliate` to register.', ephemeral: true });
        }

        const referralCount = affiliateData.referrals?.length || 0;
        const referrals = affiliateData.referrals || [];

        let commissionRate = 0;
        const tiers = Object.keys(commissions.tiers).sort((a, b) => b - a);
        for (const tier of tiers) {
            if (referralCount >= tier) {
                commissionRate = commissions.tiers[tier];
                break;
            }
        }
        
        let totalReferredValue = 0;
        for (const orderId of referrals) {
            const order = orders.find(o => o.orderId === orderId);
            if (order && typeof order.finalPrice === 'number') {
                totalReferredValue += order.finalPrice;
            }
        }

        const totalEarnings = totalReferredValue * commissionRate;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`${interaction.user.username}'s Affiliate Dashboard`)
            .addFields(
                { name: 'Your Affiliate Code', value: `\`${affiliateData.code}\``, inline: false },
                { name: 'Total Referrals', value: `**${referralCount}**`, inline: true },
                { name: 'Current Commission Tier', value: `**${commissionRate * 100}%**`, inline: true },
                { name: 'Total Revenue Generated', value: `\`Rp ${totalReferredValue.toLocaleString('id-ID')}\``, inline: false },
                { name: 'Estimated Earnings', value: `\`Rp ${totalEarnings.toLocaleString('id-ID')}\``, inline: false }
            )
            .setFooter({ text: 'Earnings are estimates based on completed sales.' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};