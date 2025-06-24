const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('redeem')
        .setDescription('Redeem an affiliate code for your order in this ticket.')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('The affiliate code you want to use')
                .setRequired(true)),
    async execute(interaction) {
        const { pendingOrders, affiliates } = interaction.client;
        const channelId = interaction.channel.id;

        if (!interaction.channel.name.startsWith('ticket-')) {
            return interaction.reply({ content: 'This command can only be used inside an active ticket channel.', ephemeral: true });
        }

        const pendingOrder = pendingOrders.get(channelId);
        if (!pendingOrder) {
            return interaction.reply({ content: 'There is no pending order associated with this ticket.', ephemeral: true });
        }
        
        if (pendingOrder.affiliateCode) {
            return interaction.reply({ content: `An affiliate code (\`${pendingOrder.affiliateCode}\`) has already been applied to this order.`, ephemeral: true });
        }

        const codeToRedeem = interaction.options.getString('code').toLowerCase();
        
        // Find the affiliate by their code
        const affiliate = Array.from(affiliates.values()).find(aff => aff.code.toLowerCase() === codeToRedeem);

        if (!affiliate) {
            return interaction.reply({ content: 'That affiliate code is invalid. Please check the code and try again.', ephemeral: true });
        }
        
        // Prevent users from redeeming their own code
        if (affiliate.userId === interaction.user.id) {
            return interaction.reply({ content: 'You cannot redeem your own affiliate code.', ephemeral: true });
        }

        // Apply the code
        pendingOrder.affiliateCode = affiliate.code;
        pendingOrders.set(channelId, pendingOrder);

        await interaction.reply({
            content: `✅ Success! Affiliate code \`${affiliate.code}\` has been applied to your order. The affiliate **${affiliate.username}** will be credited upon completion.`
        });
    },
};