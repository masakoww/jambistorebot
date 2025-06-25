const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('salestop')
        .setDescription('[Admin] Shows the best-selling products.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const { products } = interaction.client;

        const sortedProducts = products
            .filter(p => p.totalSold > 0)
            .sort((a, b) => b.totalSold - a.totalSold)
            .slice(0, 10);

        if (sortedProducts.length === 0) {
            return interaction.editReply({ content: 'No products have been sold yet.' });
        }

        const description = sortedProducts.map((p, index) => {
            return `**${index + 1}.** ${p.title} - **${p.totalSold}x** sold`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#E67E22')
            .setTitle('🔥 Best Sellers')
            .setDescription(description);

        await interaction.editReply({ embeds: [embed] });
    }
};