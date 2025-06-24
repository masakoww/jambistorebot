const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commission')
        .setDescription('Check your current affiliate stats and earnings.'),
    async execute(interaction) {
        const { affiliates, orders, commissions } = interaction.client;
        const userId = interaction.user.id;

        const affiliateData = affiliates.get(userId);
        if (!affiliateData) {
            return interaction.reply({ content: 'You are not registered as an affiliate. Use `/daftar-affiliate` to register.', ephemeral: true });
        }

        // CORRECTED: Use optional chaining for safety. If .referrals is missing, count is 0.
        const referralCount = affiliateData.referrals?.length || 0;
        const referrals = affiliateData.referrals || [];

        // Determine commission tier
        let commissionRate = 0;
        const tiers = Object.keys(commissions.tiers).sort((a, b) => b - a);
        for (const tier of tiers) {
            if (referralCount >= tier) {
                commissionRate = commissions.tiers[tier];
                break;
            }
        }
        
        // Calculate total referred revenue
        let totalReferredValue = 0;
        // CORRECTED: Loop over the safe 'referrals' array.
        for (const orderId of referrals) {
            const order = orders.find(o => o.orderId === orderId);
            if (order && typeof order.price === 'number') {
                totalReferredValue += order.price;
            }
        }

        const totalEarnings = totalReferredValue * commissionRate;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`${interaction.user.username}'s Affiliate Stats`)
            .addFields(
                { name: 'Total Referrals', value: `**${referralCount}**`, inline: true },
                { name: 'Current Tier', value: `**${commissionRate * 100}%**`, inline: true },
                { name: 'Total Revenue Generated', value: `\`Rp ${totalReferredValue.toLocaleString('id-ID')}\``, inline: false },
                { name: 'Estimated Earnings', value: `\`Rp ${totalEarnings.toLocaleString('id-ID')}\``, inline: false }
            )
            .setFooter({ text: 'Earnings are estimates based on completed sales.' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};