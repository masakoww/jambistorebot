FiveMart Discord Bot: Administrator's Guide
1. Overview
Welcome to the FiveMart Bot, a comprehensive management tool designed to automate and streamline your Discord store's operations. This bot integrates a full e-commerce system, an automated security module, an affiliate program, and user engagement features into a single, powerful platform.

This guide provides all necessary information for server administrators to set up, configure, and operate the bot effectively.

2. Core Features
The bot is built on a modular architecture, with several key systems:

🛒 E-commerce System: A complete product management and purchase pipeline. Admins can post items with fixed prices and stock, and users can purchase them through an interactive workflow that creates a private ticket for fulfillment.

🛡️ Security Module: An automated, passive system that scans all messages from non-administrative users for threats. It detects and removes phishing links, dangerous file uploads, and message spam, with a progressive warning and punishment system.

🤝 Affiliate Program: A performance-based system that allows users to register for a unique referral code. It tracks successful referrals from completed orders, calculates commissions based on tiers, and provides a public leaderboard.

🎉 Giveaway System: An admin-controlled module for running automated giveaways. Features include setting a duration, number of winners, and a "secret winner" override.

🛠️ Administrative Suite: A set of secure slash commands for managing the bot's various systems, accessible only to authorized administrators.

3. Setup and Configuration
Follow these steps to ensure the bot is configured correctly.

3.1. Installation
Before running the bot, you must install its dependencies. Open your terminal in the bot's project directory and run:

npm install

3.2. Environment Configuration (.env file)
The .env file contains all the critical API keys and configuration variables for your bot. This file must be filled out correctly for the bot to function.

Variable

Description

Example

DISCORD_TOKEN

(Required) The bot's secret token from the Discord Developer Portal.

M...

CLIENT_ID

(Required) The bot's Application ID from the Discord Developer Portal.

13...

GUILD_ID

(Required) Your Discord server's ID. Used for instant command registration.

11...

LOG_CHANNEL_ID

(Required) The channel ID where security alerts will be logged.

13...

TESTIMONIAL_CHANNEL_ID

(Required) The public channel ID for posting formatted testimonials.

13...

FEEDBACK_LOG_CHANNEL_ID

(Required) The private channel ID for logging raw customer feedback.

13...

AUTHORIZED_USERS

(Required) A comma-separated list of "root admin" User IDs. These users have ultimate control.

1043090988731732078,987654321012345678

3.3. Role Permissions
For flexible permission management, the bot recognizes a specific role.

Create a Role: In your Server Settings > Roles, create a new role named exactly Bot Admin.

Assign Role: Assign this role to any staff members who need access to the bot's administrative commands.

A user is considered an administrator if they meet any of these conditions:

Their user ID is in the AUTHORIZED_USERS list in the .env file.

They have the server-wide Administrator permission.

They have the Bot Admin role.

4. Command Reference
4.1. Shop Management (/)
Command

Description

Options

/postitem

Posts a new product to a shop channel and saves it to the database.

name, price, stock, description, image_url, channel

/edititem

Edits the price or stock of an existing product and updates its message.

product, new_price, new_stock

/removeitem

Deletes a product from the database and removes its shop message.

product

4.2. Administrative Commands (/)
Command

Description

Options

/ann

Sends a general server announcement as plain text.

channel, message, ping_everyone (optional)

/testimonial

Creates and posts a formatted testimonial to the public channel.

buyer, product, price, image

/close

Closes a ticket and finalizes the order.

status (done or cancelled)

/export

Exports all completed order data as a CSV file.

None

4.3. Affiliate Commands (/)
Command

Description

/daftar-affiliate

Allows any user to register for the affiliate program.

/redeem

Used by a customer inside a ticket to apply an affiliate's code.

/commission

Allows a registered affiliate to check their personal stats.

/leaderboard

Displays a public leaderboard of the top-performing affiliates.

4.4. Security Commands (/)
Command

Description

Options

/addphishing

Adds a domain to the phishing blacklist.

domain

/removephishing

Removes a domain from the phishing blacklist.

domain

/listphishing

Lists all currently blacklisted domains.

None

/userinfo

Displays a security profile for a user.

user

/warnings

Checks the warning count for a user.

user

/clearwarnings

Clears all warnings for a user.

user

/violationhistory

Shows the detailed violation history for a user.

user

4.5. Fun & Utility Commands (/)
Command

Description

Options

/help

Displays a dynamic list of available commands.

None

/avatar

Shows a user's avatar.

user (optional)

/coinflip

Flips a coin.

None

/giveaway

Manages the giveaway system (start, reroll, end).

Varies by subcommand

4.6. Payment Commands (!)
These commands are admin-only and must be used with the ! prefix inside a ticket channel.

!bca

!bri

!dana

!gopay

!linkaja

!ovo

!qris

!shopeepay

5. Standard Admin Workflows
5.1. Adding a New Product
Use the /postitem command.

Fill out all the required options, including the name, price, stock, and the channel where the item should be displayed.

The bot will post the item and save it to the database automatically.

5.2. Fulfilling an Order
A user creates a ticket by purchasing an item. A new private channel is created with an order summary.

Join the ticket channel and communicate with the user.

When they are ready to pay, use the appropriate prefix command (e.g., !dana) to provide them with the payment details.

Once payment is confirmed and the product is delivered, run /close status: Done.

The bot will automatically update the stock, log the order, credit any affiliates, and send a feedback request to the user before deleting the ticket.
