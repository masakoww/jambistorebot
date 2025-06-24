const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const ms = require('ms');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('[Admin] Manages the giveaway system.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(subcommand =>
            subcommand.setName('start').setDescription('Starts a new giveaway.')
                .addStringOption(option => option.setName('duration').setDescription('How long the giveaway should last (e.g., 10m, 1h, 2d)').setRequired(true))
                .addIntegerOption(option => option.setName('winners').setDescription('How many winners to draw').setRequired(true))
                .addStringOption(option => option.setName('prize').setDescription('What the prize is').setRequired(true))
                .addChannelOption(option => option.setName('channel').setDescription('Channel to post the giveaway in').addChannelTypes(ChannelType.GuildText).setRequired(false))
                .addUserOption(option => option.setName('required_winner').setDescription('[Secret] Pre-selects a user to win if they enter.').setRequired(false))
        )
        .addSubcommand(subcommand => subcommand.setName('reroll').setDescription('Re-rolls a winner for an ended giveaway.').addStringOption(option => option.setName('message_id').setDescription('The message ID of the giveaway to re-roll').setRequired(true)))
        .addSubcommand(subcommand => subcommand.setName('end').setDescription('Ends a running giveaway immediately.').addStringOption(option => option.setName('message_id').setDescription('The message ID of the giveaway to end').setRequired(true))),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'start') await handleStart(interaction);
        else if (subcommand === 'reroll') await handleReroll(interaction);
        else if (subcommand === 'end') await handleEnd(interaction);
    },
};

async function handleStart(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const durationStr = interaction.options.getString('duration');
    const winnerCount = interaction.options.getInteger('winners');
    const prize = interaction.options.getString('prize');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const requiredWinner = interaction.options.getUser('required_winner');

    const durationMs = ms(durationStr);
    if (!durationMs) {
        return interaction.editReply({ content: 'Invalid duration format. Use formats like `10m`, `1h`, or `2d`.' });
    }

    const endTime = Date.now() + durationMs;
    const endTimeTimestamp = Math.floor(endTime / 1000);

    const embed = new EmbedBuilder().setColor('#3498DB').setTitle(`🎉 GIVEAWAY: ${prize} 🎉`).setDescription(`Click the button to enter!\n\n**Ends:** <t:${endTimeTimestamp}:R>\n**Winners:** ${winnerCount}`).setTimestamp(endTime).setFooter({ text: 'Ends at' });
    const enterButton = new ButtonBuilder().setCustomId('giveaway_enter_new').setLabel('Enter').setStyle(ButtonStyle.Success).setEmoji('🎉');
    
    try {
        const giveawayMessage = await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(enterButton)] });
        enterButton.setCustomId(`giveaway_enter_${giveawayMessage.id}`);
        await giveawayMessage.edit({ components: [new ActionRowBuilder().addComponents(enterButton)] });
        
        const { giveaways } = interaction.client;
        const giveawayData = {
            messageId: giveawayMessage.id, channelId: channel.id, guildId: interaction.guild.id,
            startTime: Date.now(), endTime, prize, winnerCount,
            participants: [], status: 'running',
            requiredWinnerId: requiredWinner ? requiredWinner.id : null,
        };
        giveaways.set(giveawayMessage.id, giveawayData);
        
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(__dirname, '../../giveaways.json'), JSON.stringify(Object.fromEntries(giveaways), null, 2));

        await interaction.editReply({ content: 'Giveaway started successfully!' });
    } catch (error) {
        console.error("Failed to start giveaway:", error);
        await interaction.editReply({ content: 'An error occurred. Check my permissions in that channel.' });
    }
}

async function handleReroll(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const messageId = interaction.options.getString('message_id');
    const { giveaways } = interaction.client;
    const giveaway = giveaways.get(messageId);

    if (!giveaway || giveaway.status !== 'ended') {
        return interaction.editReply({ content: 'This giveaway is not ended or does not exist.' });
    }
    const participants = giveaway.participants;
    if (participants.length === 0) {
        return interaction.editReply({ content: 'There were no participants to re-roll from.' });
    }
    const newWinner = participants[Math.floor(Math.random() * participants.length)];
    
    await interaction.channel.send(`🎉 New winner re-rolled for the **${giveaway.prize}**! Congratulations, <@${newWinner}>!`);
    await interaction.editReply({ content: `Re-rolled winner successfully.` });
}
async function handleEnd(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const messageId = interaction.options.getString('message_id');
    const { giveaways } = interaction.client;
    const giveaway = giveaways.get(messageId);

    if (!giveaway || giveaway.status !== 'running') {
        return interaction.editReply({ content: 'This giveaway is not running or does not exist.' });
    }
    
    giveaway.endTime = Date.now() - 1000;
    giveaways.set(messageId, giveaway);
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(path.join(__dirname, '../../giveaways.json'), JSON.stringify(Object.fromEntries(giveaways), null, 2));

    await interaction.editReply({ content: 'Giveaway will be ended on the next check (within 15 seconds).' });
}
