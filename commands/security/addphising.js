const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');

module.exports = {
    isSecurityCommand: true,
    data: new SlashCommandBuilder()
        .setName('addphishing')
        .setDescription('[Security] Adds a domain to the phishing detection list.')
        .addStringOption(option =>
            option.setName('domain')
                .setDescription('The domain to add (e.g., dscord.com)')
                .setRequired(true)),
    async execute(interaction) {
        const domainToAdd = interaction.options.getString('domain').toLowerCase();
        const { config } = interaction.client.security;

        if (!config.phishingDomains.includes(domainToAdd)) {
            config.phishingDomains.push(domainToAdd);
            // Save the updated list back to the file
            try {
                fs.writeFileSync('phishing_domains.json', JSON.stringify(config.phishingDomains, null, 2));
                await interaction.reply({ content: `✅ Added \`${domainToAdd}\` to the phishing domain list.`, ephemeral: true });
            } catch (error) {
                console.error('Failed to save phishing domains:', error);
                await interaction.reply({ content: 'Error: Could not save the updated domain list.', ephemeral: true });
            }
        } else {
            await interaction.reply({ content: `⚠️ Domain \`${domainToAdd}\` is already in the list.`, ephemeral: true });
        }
    },
};