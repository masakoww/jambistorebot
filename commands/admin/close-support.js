const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('close-support')
        .setDescription('[Admin] Closes an after-purchase support ticket.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for closing the ticket.')
                .setRequired(false)
        ),
    async execute(interaction) {
        const channel = interaction.channel;
        if (!channel.name.startsWith('support-')) {
            return interaction.reply({ content: 'This command can only be used in a support ticket channel.', ephemeral: true });
        }

        const reason = interaction.options.getString('reason') || 'Support ticket resolved.';

        await interaction.reply({ content: `✅ This support ticket will be closed in 10 seconds. Reason: ${reason}` });

        setTimeout(() => {
            channel.delete(`Support ticket closed by ${interaction.user.tag}. Reason: ${reason}`)
                .catch(error => console.error(`Could not delete support ticket ${channel.id}:`, error));
        }, 10000);
    },
};