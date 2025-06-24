const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flips a coin.'),
    async execute(interaction) {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const color = result === 'Heads' ? '#FFD700' : '#C0C0C0'; // Gold for Heads, Silver for Tails

        const coinEmbed = new EmbedBuilder()
            .setColor(color)
            .setTitle('Coin Flip Result')
            .setDescription(`The coin landed on... **${result}**!`)
            .setTimestamp();

        await interaction.reply({ embeds: [coinEmbed] });
    },
};