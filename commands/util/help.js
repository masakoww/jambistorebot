const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const path = require('node:path');

// Helper function to format category names for display
function formatCategoryName(name) {
    const icons = {
        'admin': '🛠️',
        'affiliate': '🤝',
        'fun': '🎉',
        'security': '🛡️',
        'shop': '🛒',
        'utility': '👤',
    };
    const formatted = name.charAt(0).toUpperCase() + name.slice(1);
    return `${icons[name] || '📄'} ${formatted}`;
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Lists all available commands.'),
    async execute(interaction) {
        const { commands, security } = interaction.client;
        const member = interaction.member;

        const isRootUser = security.config.authorizedUsers.includes(member.id);
        const hasAdminPerm = member.permissions.has(PermissionsBitField.Flags.Administrator);
        const hasBotAdminRole = member.roles.cache.some(role => role.name === 'Bot Admin');
        const userIsAdmin = isRootUser || hasAdminPerm || hasBotAdminRole;

        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Bot Command List')
            .setAuthor({ name: interaction.client.user.username, iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();

        const categories = {};

        // Dynamically categorize commands based on their folder
        commands.forEach(cmd => {
            // Extract the parent folder name (e.g., "admin", "shop")
            const dir = path.basename(path.dirname(cmd.filePath));
            if (!categories[dir]) {
                categories[dir] = [];
            }
            categories[dir].push(`**/${cmd.data.name}** - ${cmd.data.description}`);
        });

        // Add fields for each category
        for (const categoryName in categories) {
            const commandList = categories[categoryName];
            if (commandList.length > 0) {
                 const isAdminCategory = ['admin', 'security', 'shop'].includes(categoryName);
                 if (!isAdminCategory || (isAdminCategory && userIsAdmin)) {
                    helpEmbed.addFields({
                        name: formatCategoryName(categoryName),
                        value: commandList.join('\n')
                    });
                 }
            }
        }
        
        await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    },
};