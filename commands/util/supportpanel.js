const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('supportpanel')
        .setDescription('[Admin] Posts the panel for opening after-purchase support tickets.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addChannelOption(option => 
            option.setName('channel')
            .setDescription('The channel to post the panel in.')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        ),
    async execute(interaction) {
        const channel = interaction.options.getChannel('channel');

        const embed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setTitle('Claim Guarantee / After-Purchase Support')
            .setDescription('Do you have an issue with a completed purchase or need to claim your guarantee?\n\nClick the button below to open a support ticket. Please have your **Order ID** ready. You can find this in the invoice that was sent to your DMs when you completed your purchase.');

        const button = new ButtonBuilder()
            .setCustomId('support_ticket_create')
            .setLabel('Claim Guarantee')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🛡️');

        const row = new ActionRowBuilder().addComponents(button);

        try {
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ Support panel successfully posted in ${channel}.`, ephemeral: true });
        } catch(e) {
            console.error(e);
            await interaction.reply({ content: `Failed to send panel. Do I have permissions in that channel?`, ephemeral: true });
        }
    }
};