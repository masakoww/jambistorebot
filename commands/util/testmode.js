const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('testmode')
        .setDescription('[Admin] Enable or disable test mode.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addBooleanOption(option => option.setName('enabled').setDescription('Set to true to enable, false to disable.').setRequired(true)),
    async execute(interaction) {
        const enabled = interaction.options.getBoolean('enabled');
        interaction.client.settings.testMode = enabled;
        
        await interaction.reply({ 
            content: `✅ Test mode has been **${enabled ? 'ENABLED' : 'DISABLED'}**.
            ${enabled ? 'New orders will NOT be logged and stock will NOT be reduced.' : 'Normal operation has resumed.'}`,
            ephemeral: true 
        });
    }
};