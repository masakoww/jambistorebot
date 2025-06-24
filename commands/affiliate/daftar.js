const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daftar-affiliate')
        .setDescription('Register as an affiliate to get your unique referral code.'),
    async execute(interaction) {
        const { affiliates } = interaction.client;
        const userId = interaction.user.id;

        if (affiliates.has(userId)) {
            const existingAffiliate = affiliates.get(userId);
            return interaction.reply({
                content: `You are already registered as an affiliate! Your code is: \`${existingAffiliate.code}\``,
                ephemeral: true
            });
        }

        // Generate a unique code
        const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
        let affiliateCode;
        let isUnique = false;
        while (!isUnique) {
            const randomDigits = Math.floor(100 + Math.random() * 900); // 3-digit number
            affiliateCode = `${username}-${randomDigits}`;
            // Check if code already exists
            const codeExists = Array.from(affiliates.values()).some(aff => aff.code === affiliateCode);
            if (!codeExists) {
                isUnique = true;
            }
        }
        
        const newAffiliate = {
            userId: userId,
            username: interaction.user.username,
            code: affiliateCode,
            referrals: [],
            registeredAt: new Date().toISOString()
        };

        affiliates.set(userId, newAffiliate);
        
        // Save to file (assuming saveAffiliates function exists in index)
        const fs = require('fs');
        try {
            fs.writeFileSync('affiliates.json', JSON.stringify(Object.fromEntries(affiliates), null, 2));
        } catch (error) {
            console.error('Failed to save new affiliate:', error);
            return interaction.reply({ content: 'An error occurred during registration. Please try again.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ Affiliate Registration Successful!')
            .setDescription(`Welcome to the affiliate program, ${interaction.user.username}!\n\nShare your unique code with others. When they use it on their order, you'll get credit for the referral.`)
            .addFields({ name: 'Your Unique Affiliate Code', value: `\`\`\`${affiliateCode}\`\`\`` })
            .setFooter({ text: 'You can check your earnings with /commission later.' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};