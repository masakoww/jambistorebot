const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// --- Helper Functions ---
function saveTiers(tiers) {
    fs.writeFileSync(path.join(__dirname, '../../affiliate_tiers.json'), JSON.stringify(tiers, null, 2));
}
function saveAffiliates(affiliates) {
    fs.writeFileSync(path.join(__dirname, '../../affiliates.json'), JSON.stringify(Object.fromEntries(affiliates), null, 2));
}

// --- Subcommand Handlers ---
async function handleTierCreate(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString('name');
    const percentage = interaction.options.getNumber('percentage');
    const tiers = interaction.client.affiliateTiers;
    if (tiers.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        return interaction.editReply({ content: 'A tier with this name already exists.' });
    }
    if (percentage < 0 || percentage > 100) {
        return interaction.editReply({ content: 'Percentage must be between 0 and 100.' });
    }
    tiers.push({ name, percentage });
    saveTiers(tiers);
    await interaction.editReply({ content: `✅ Successfully created tier **${name}** with a **${percentage}%** commission.` });
}

async function handleTierDelete(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const name = interaction.options.getString('name');
    let tiers = interaction.client.affiliateTiers;
    if (!tiers.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        return interaction.editReply({ content: 'A tier with this name does not exist.' });
    }
    interaction.client.affiliateTiers = tiers.filter(t => t.name.toLowerCase() !== name.toLowerCase());
    saveTiers(interaction.client.affiliateTiers);
    await interaction.editReply({ content: `✅ Successfully deleted tier **${name}**.` });
}

async function handleTierList(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const tiers = interaction.client.affiliateTiers;
    if (tiers.length === 0) {
        return interaction.editReply({ content: 'No affiliate tiers have been created yet.' });
    }
    const embed = new EmbedBuilder().setColor('#3498DB').setTitle('Affiliate Tiers').setDescription(tiers.map(t => `**${t.name}**: \`${t.percentage}%\``).join('\n'));
    await interaction.editReply({ embeds: [embed] });
}

async function handleSet(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const targetUser = interaction.options.getUser('user');
    const tierName = interaction.options.getString('tier');
    const { affiliates, affiliateTiers } = interaction.client;
    
    const tier = affiliateTiers.find(t => t.name.toLowerCase() === tierName.toLowerCase());
    if (!tier) {
        return interaction.editReply({ content: 'That tier does not exist. Please create it first with `/affiliate tier create`.' });
    }

    const affiliateData = affiliates.get(targetUser.id) || {};
    
    if (!affiliateData.code) {
        const username = targetUser.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
        let affiliateCode = `${username}-${Math.floor(100 + Math.random() * 900)}`;
        while (Array.from(affiliates.values()).some(aff => aff.code === affiliateCode)) {
             affiliateCode = `${username}-${Math.floor(100 + Math.random() * 900)}`;
        }
        affiliateData.code = affiliateCode;
    }

    affiliateData.userId = targetUser.id;
    affiliateData.username = targetUser.username;
    affiliateData.tier = tier.name;
    if (!affiliateData.referrals) affiliateData.referrals = [];
    if (!affiliateData.registeredAt) affiliateData.registeredAt = new Date().toISOString();

    affiliates.set(targetUser.id, affiliateData);
    saveAffiliates(affiliates);

    const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Affiliate Updated')
        .setDescription(`**${targetUser.username}** has been successfully set to the **${tier.name}** affiliate tier.`)
        .addFields({ name: 'Their Affiliate Code', value: `\`${affiliateData.code}\`` });

    try {
        await targetUser.send(`Your affiliate status has been updated in **${interaction.guild.name}**. You are now in the **${tier.name}** tier.`);
        embed.setFooter({ text: 'The user has been notified via DM.' });
    } catch (error) {
        embed.setFooter({ text: 'Warning: Could not DM the user.' });
    }

    await interaction.editReply({ embeds: [embed] });
}


module.exports = {
    isAdmin: true,
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        if (focused.name === 'tier' || focused.name === 'name') {
            const tiers = interaction.client.affiliateTiers;
            const choices = tiers.map(t => ({ name: t.name, value: t.name }));
            const filtered = choices.filter(choice => choice.name.toLowerCase().startsWith(focused.value.toLowerCase()));
            await interaction.respond(filtered.slice(0, 25));
        }
    },
    data: new SlashCommandBuilder()
        .setName('affiliate')
        .setDescription('[Admin] Manages the affiliate program.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommandGroup(group => group.setName('tier').setDescription('Manage affiliate tiers.')
            .addSubcommand(sub => sub.setName('create').setDescription('Creates a new affiliate commission tier.')
                .addStringOption(o => o.setName('name').setDescription('The name of the tier (e.g., Gold).').setRequired(true))
                .addNumberOption(o => o.setName('percentage').setDescription('The commission percentage for this tier (e.g., 5 for 5%).').setRequired(true))
            )
            .addSubcommand(sub => sub.setName('delete').setDescription('Deletes an affiliate tier.')
                .addStringOption(o => o.setName('name').setDescription('The name of the tier to delete.').setRequired(true).setAutocomplete(true))
            )
            .addSubcommand(sub => sub.setName('list').setDescription('Lists all available affiliate tiers.'))
        )
        .addSubcommand(sub => sub.setName('set').setDescription('Adds a user to the affiliate program or changes their tier.')
            .addUserOption(o => o.setName('user').setDescription('The user to add or modify.').setRequired(true))
            .addStringOption(o => o.setName('tier').setDescription('The tier to assign to the user.').setRequired(true).setAutocomplete(true))
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup(false);

        if (group === 'tier') {
            if (subcommand === 'create') await handleTierCreate(interaction);
            else if (subcommand === 'delete') await handleTierDelete(interaction);
            else if (subcommand === 'list') await handleTierList(interaction);
        } else if (subcommand === 'set') {
            await handleSet(interaction);
        }
    },
};