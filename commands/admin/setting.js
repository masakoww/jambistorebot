const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('setting')
        .setDescription('[Admin] Manages bot settings.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('ticket-category')
                .setDescription('Sets the category where new tickets will be created.')
                .addChannelOption(option =>
                    option.setName('category')
                        .setDescription('The category channel to use for tickets.')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'ticket-category') {
            await interaction.deferReply({ ephemeral: true });
            const category = interaction.options.getChannel('category');
            
            const settingsPath = path.join(__dirname, '../../settings.json');
            let settings = {};
            if (fs.existsSync(settingsPath)) {
                settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            }

            settings.ticketCategoryId = category.id;
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
            
            // Update the live config in the client
            interaction.client.settings.ticketCategoryId = category.id;

            await interaction.editReply(`✅ All new tickets will now be created under the **${category.name}** category.`);
        }
    },
};