const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Lists all available commands.'),
    async execute(interaction) {
        const { commands, security } = interaction.client;
        const member = interaction.member;

        // Determine if the user is an admin for the bot
        const isRootUser = security.config.authorizedUsers.includes(member.id);
        const hasAdminPerm = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasBotAdminRole = member.roles.cache.some(role => role.name === 'Bot Admin');
        const userIsAdmin = isRootUser || hasAdminPerm || hasBotAdminRole;

        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Bot Command List')
            .setAuthor({ name: interaction.client.user.username, iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        // Categorize commands based on their folder structure and flags
        const categories = {
            '👤 General': [],
            '🎉 Fun': [],
            '🤝 Affiliate': [],
            '🛠️ Admin': [],
            '🛡️ Security': [],
            '🛒 Shop': [],
        };

        commands.forEach(cmd => {
            const commandInfo = `**/${cmd.data.name}** - ${cmd.data.description}`;
            const commandPath = cmd.filePath.split(path.sep); // Use filePath if available, which needs to be added during loading
            
            // A simple categorization logic
            if (cmd.isAdmin || cmd.isSecurityCommand) {
                 if (cmd.filePath && cmd.filePath.includes('security')) {
                    categories['🛡️ Security'].push(commandInfo);
                 } else {
                    categories['🛠️ Admin'].push(commandInfo);
                 }
            } else if (cmd.filePath && cmd.filePath.includes('shop')) {
                categories['🛒 Shop'].push(commandInfo);
            } else if (cmd.filePath && cmd.filePath.includes('affiliate')) {
                categories['🤝 Affiliate'].push(commandInfo);
            } else if (cmd.filePath && cmd.filePath.includes('fun')) {
                categories['🎉 Fun'].push(commandInfo);
            }
             else {
                categories['👤 General'].push(commandInfo);
            }
        });
        
        // Add fields for non-admin categories
        if(categories['👤 General'].length) helpEmbed.addFields({ name: '👤 General', value: categories['👤 General'].join('\n') });
        if(categories['🎉 Fun'].length) helpEmbed.addFields({ name: '🎉 Fun', value: categories['🎉 Fun'].join('\n') });
        if(categories['🤝 Affiliate'].length) helpEmbed.addFields({ name: '🤝 Affiliate', value: categories['🤝 Affiliate'].join('\n') });


        // Add fields for admin-only categories if the user is an admin
        if (userIsAdmin) {
            if(categories['🛒 Shop'].length) helpEmbed.addFields({ name: '🛒 Shop Management', value: categories['🛒 Shop'].join('\n') });
            if(categories['🛠️ Admin'].length) helpEmbed.addFields({ name: '🛠️ Admin', value: categories['🛠️ Admin'].join('\n') });
            if(categories['🛡️ Security'].length) helpEmbed.addFields({ name: '🛡️ Security', value: categories['🛡️ Security'].join('\n') });
        }

        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    },
};