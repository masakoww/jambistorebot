const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    isSecurityCommand: true,
    data: new SlashCommandBuilder()
        .setName('clearwarnings')
        .setDescription('[Security] Clears all active warnings for a user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose warnings will be cleared')
                .setRequired(true)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const { warnings } = interaction.client.security;

        if (warnings.has(targetUser.id)) {
            warnings.delete(targetUser.id);
            // Persist the change
            fs.writeFileSync('warnings.json', JSON.stringify(Object.fromEntries(warnings), null, 2));
            await interaction.reply({ content: `✅ All warnings for ${targetUser.tag} have been cleared.`, ephemeral: true });
        } else {
            await interaction.reply({ content: `ℹ️ ${targetUser.tag} has no active warnings to clear.`, ephemeral: true });
        }
    },
};