const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');

module.exports = {
    isSecurityCommand: true,
    data: new SlashCommandBuilder()
        .setName('removephishing')
        .setDescription('[Security] Removes a domain from the phishing detection list.')
        .addStringOption(option =>
            option.setName('domain')
                .setDescription('The domain to remove')
                .setRequired(true)),
    async execute(interaction) {
        const domainToRemove = interaction.options.getString('domain').toLowerCase();
        const { config } = interaction.client.security;
        const index = config.phishingDomains.indexOf(domainToRemove);

        if (index > -1) {
            config.phishingDomains.splice(index, 1);
            // Save the updated list back to the file
            try {
                fs.writeFileSync('phishing_domains.json', JSON.stringify(config.phishingDomains, null, 2));
                await interaction.reply({ content: `✅ Removed \`${domainToRemove}\` from the phishing domain list.`, ephemeral: true });
            } catch (error) {
                console.error('Failed to save phishing domains:', error);
                await interaction.reply({ content: 'Error: Could not save the updated domain list.', ephemeral: true });
            }
        } else {
            await interaction.reply({ content: `⚠️ Domain \`${domainToRemove}\` was not found in the list.`, ephemeral: true });
        }
    },
};