import { db } from "./client";
import { users } from "./schema/users";
import { categories } from "./schema/categories";
import { products } from "./schema/products";
import { settings } from "./schema/settings";
import { sliders } from "./schema/sliders";
import { coupons } from "./schema/coupons";
import { gifts } from "./schema/gifts";
import { spinPrizes } from "./schema/spin";
import { events } from "./schema/events";
import { orders } from "./schema/orders";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Starting complete database seeding...");

  // 1. Seed Users (Admin & User)
  const usersToSeed = [
    { email: "arbazmr123@gmail.com", name: "Arbaz Admin", role: "admin" },
    { email: "admin@virithstore.com", name: "Virith Admin", role: "admin" },
    { email: "user@virithstore.com", name: "Demo Customer", role: "user" },
  ];

  const hashedPassword = await bcrypt.hash("password123", 10);

  for (const u of usersToSeed) {
    const existing = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    if (!existing.length) {
      await db.insert(users).values({
        email: u.email,
        password: hashedPassword,
        name: u.name,
        role: u.role as any,
        isVerified: true,
        authProvider: "email",
      });
      console.log(`✅ User seeded: ${u.email} (${u.role})`);
    } else if (existing[0].role !== u.role) {
      await db.update(users).set({ role: u.role as any }).where(eq(users.email, u.email));
      console.log(`🔄 User updated to ${u.role}: ${u.email}`);
    }
  }

  // 2. Seed Categories
  const existingCats = await db.select().from(categories);
  let catMap: Record<string, string> = {};

  if (!existingCats.length) {
    const insertedCats = await db.insert(categories).values([
      {
        name: "Streaming & Entertainment",
        nameKh: "សេវាកម្មទស្សនាខ្សែភាពយន្ត",
        slug: "streaming-entertainment",
        icon: "Film",
        order: 1,
        isActive: true,
      },
      {
        name: "AI & Productivity",
        nameKh: "បញ្ញាសិប្បនិម្មិត និងការងារ",
        slug: "ai-productivity",
        icon: "Sparkles",
        order: 2,
        isActive: true,
      },
      {
        name: "Gaming & Subscriptions",
        nameKh: "គណនីហ្គេម និងកាត",
        slug: "gaming-subscriptions",
        icon: "Gamepad2",
        order: 3,
        isActive: true,
      },
      {
        name: "Creative & Design",
        nameKh: "ការរចនា និងក្រាហ្វិក",
        slug: "creative-design",
        icon: "Palette",
        order: 4,
        isActive: true,
      },
      {
        name: "Security & VPN",
        nameKh: "សុវត្ថិភាព និង VPN",
        slug: "security-vpn",
        icon: "Shield",
        order: 5,
        isActive: true,
      },
    ] as any).returning();

    for (const c of insertedCats) {
      catMap[c.slug] = c.id;
    }
    console.log("✅ Categories seeded successfully");
  } else {
    for (const c of existingCats) {
      catMap[c.slug] = c.id;
    }
  }

  const streamId = catMap["streaming-entertainment"] || Object.values(catMap)[0];
  const aiId = catMap["ai-productivity"] || streamId;
  const gameId = catMap["gaming-subscriptions"] || streamId;
  const creativeId = catMap["creative-design"] || streamId;
  const vpnId = catMap["security-vpn"] || streamId;

  // 3. Seed Sliders / Hero Banners
  const existingSliders = await db.select().from(sliders).limit(1);
  if (!existingSliders.length) {
    await db.insert(sliders).values([
      {
        images: [
          { url: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1600&auto=format&fit=crop&q=80" },
          { url: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=1600&auto=format&fit=crop&q=80" },
          { url: "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=1600&auto=format&fit=crop&q=80" },
          { url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600&auto=format&fit=crop&q=80" },
        ],
      },
    ]);
    console.log("✅ Hero Sliders & Banners seeded");
  }

  // 4. Seed Products
  const existingProds = await db.select().from(products).limit(1);
  if (!existingProds.length) {
    await db.insert(products).values([
      {
        name: "Netflix Premium 4K UHD",
        slug: "netflix-premium-4k",
        type: "account",
        description: "Official Netflix 4K UHD Private Profile with dedicated PIN code and 30-day uninterrupted replacement guarantee. Instant credentials delivery after payment.",
        guide: "1. Open Netflix App or visit netflix.com\n2. Enter provided email & password\n3. Select your assigned private profile number and enter your 4-digit PIN\n4. Enjoy Ultra HD 4K streaming!",
        categoryId: streamId,
        image: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=600&auto=format&fit=crop&q=70",
        banner: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1200&auto=format&fit=crop&q=80",
        slides: [
          "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=1200&auto=format&fit=crop&q=80",
          "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=1200&auto=format&fit=crop&q=80"
        ],
        isPopular: true,
        isHot: true,
        isFeatured: true,
        isAvailable: true,
        isAutoDelivery: true,
        stock: true,
        cost: [
          { id: "1", name: "1 Month Private Profile (PIN Protected)", price: "3.99", costPrice: "2.50", stock: 25, isActive: true },
          { id: "2", name: "3 Months Private Profile", price: "10.99", costPrice: "7.00", stock: 15, isActive: true },
          { id: "3", name: "1 Year Full Private Account (5 Profiles)", price: "38.99", costPrice: "25.00", stock: 8, isActive: true },
        ],
        fields: [],
      },
      {
        name: "Spotify Premium Individual",
        slug: "spotify-premium",
        type: "account",
        description: "Ad-free music listening with unlimited skips, offline download playback, and ultra-high quality 320kbps audio streaming on all devices.",
        guide: "Login directly to Spotify using the supplied account credentials or accept the family plan invitation link sent directly to your order page.",
        categoryId: streamId,
        image: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=600&auto=format&fit=crop&q=70",
        banner: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=1200&auto=format&fit=crop&q=80",
        slides: ["https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=1200&auto=format&fit=crop&q=80"],
        isPopular: true,
        isHot: false,
        isFeatured: true,
        isAvailable: true,
        isAutoDelivery: true,
        stock: true,
        cost: [
          { id: "1", name: "1 Month Premium Account", price: "2.50", costPrice: "1.50", stock: 30, isActive: true },
          { id: "2", name: "6 Months Premium Account", price: "12.00", costPrice: "8.00", stock: 20, isActive: true },
          { id: "3", name: "12 Months Full Access", price: "22.00", costPrice: "14.00", stock: 15, isActive: true },
        ],
        fields: [],
      },
      {
        name: "ChatGPT Plus & GPT-4o",
        slug: "chatgpt-plus",
        type: "account",
        description: "Direct access to OpenAI ChatGPT Plus with GPT-4o, DALL-E 3 image generation, Web Browsing, Advanced Voice Mode, and Code Interpreter.",
        guide: "Log in with the credentials provided at chatgpt.com. Do not modify account recovery settings.",
        categoryId: aiId,
        image: "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=600&auto=format&fit=crop&q=70",
        banner: "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=1200&auto=format&fit=crop&q=80",
        slides: ["https://images.unsplash.com/photo-1677442136019-21780efad99a?w=1200&auto=format&fit=crop&q=80"],
        isPopular: true,
        isHot: true,
        isFeatured: true,
        isAvailable: true,
        isAutoDelivery: true,
        stock: true,
        cost: [
          { id: "1", name: "1 Month Private Account", price: "9.99", costPrice: "6.00", stock: 15, isActive: true },
          { id: "2", name: "3 Months Private Account", price: "27.00", costPrice: "17.00", stock: 10, isActive: true },
        ],
        fields: [],
      },
      {
        name: "YouTube Premium & Music",
        slug: "youtube-premium",
        type: "digital-service",
        description: "Ad-free videos, background playback on mobile while screen is locked, and full YouTube Music Premium included. Activated on your own Google email.",
        guide: "Enter your Google Gmail address below. You will receive an official Google Family invitation email to accept within 2-5 minutes.",
        categoryId: streamId,
        image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&auto=format&fit=crop&q=70",
        banner: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1200&auto=format&fit=crop&q=80",
        slides: ["https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=1200&auto=format&fit=crop&q=80"],
        isPopular: true,
        isHot: false,
        isFeatured: true,
        isAvailable: true,
        isAutoDelivery: false,
        stock: true,
        cost: [
          { id: "1", name: "1 Month Family Invite (Own Account)", price: "1.99", costPrice: "1.00", stock: 50, isActive: true },
          { id: "2", name: "6 Months Family Invite (Own Account)", price: "9.99", costPrice: "6.00", stock: 40, isActive: true },
          { id: "3", name: "12 Months Family Invite (Own Account)", price: "18.99", costPrice: "11.00", stock: 25, isActive: true },
        ],
        fields: [
          { label: "Your Google Account Email", name: "email", type: "email", required: true, placeholder: "youremail@gmail.com" }
        ],
      },
      {
        name: "Discord Nitro + 2 Server Boosts",
        slug: "discord-nitro",
        type: "digital-service",
        description: "Unlock animated emojis anywhere, custom profile banner & badges, 500MB upload limits, 4K 60FPS streaming, and 2 free server boosts.",
        guide: "Enter your Discord username. You will receive a gift activation link that applies instantly to your Discord profile.",
        categoryId: gameId,
        image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=70",
        banner: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80",
        slides: ["https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80"],
        isPopular: true,
        isHot: true,
        isFeatured: true,
        isAvailable: true,
        isAutoDelivery: true,
        stock: true,
        cost: [
          { id: "1", name: "1 Month Nitro + 2 Boosts Gift Link", price: "4.50", costPrice: "3.00", stock: 35, isActive: true },
          { id: "2", name: "1 Year Nitro + 2 Boosts Gift Link", price: "42.00", costPrice: "28.00", stock: 15, isActive: true },
        ],
        fields: [
          { label: "Discord Username (Optional)", name: "discord_username", type: "text", required: false, placeholder: "e.g. virith#0001" }
        ],
      },
      {
        name: "Canva Pro 1 Year Subscription",
        slug: "canva-pro",
        type: "digital-service",
        description: "Unlimited access to 100M+ premium stock photos, videos, graphics, audio, Brand Kits, Magic Resize, and background remover tools.",
        guide: "Provide your Canva login email. We will add your account to our verified Canva Enterprise Team with full Pro features.",
        categoryId: creativeId,
        image: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&auto=format&fit=crop&q=70",
        banner: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=1200&auto=format&fit=crop&q=80",
        slides: ["https://images.unsplash.com/photo-1626785774573-4b799315345d?w=1200&auto=format&fit=crop&q=80"],
        isPopular: false,
        isHot: false,
        isFeatured: true,
        isAvailable: true,
        isAutoDelivery: false,
        stock: true,
        cost: [
          { id: "1", name: "1 Year Team Member Access", price: "6.99", costPrice: "4.00", stock: 60, isActive: true },
          { id: "2", name: "Lifetime Team Access", price: "14.99", costPrice: "8.00", stock: 30, isActive: true },
        ],
        fields: [
          { label: "Your Canva Email", name: "canva_email", type: "email", required: true, placeholder: "designer@gmail.com" }
        ],
      },
      {
        name: "NordVPN Premium",
        slug: "nordvpn-premium",
        type: "account",
        description: "High-speed encrypted VPN with 6000+ servers in 111 countries, Threat Protection anti-malware, and Double VPN security features.",
        guide: "Download NordVPN on Windows, Mac, iOS, or Android and log in using the credentials revealed after checkout.",
        categoryId: vpnId,
        image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=70",
        banner: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&auto=format&fit=crop&q=80",
        slides: ["https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&auto=format&fit=crop&q=80"],
        isPopular: false,
        isHot: false,
        isFeatured: true,
        isAvailable: true,
        isAutoDelivery: true,
        stock: true,
        cost: [
          { id: "1", name: "1 Year Premium Account (6 Devices)", price: "15.99", costPrice: "10.00", stock: 20, isActive: true },
          { id: "2", name: "2 Years Premium Account (6 Devices)", price: "26.99", costPrice: "17.00", stock: 12, isActive: true },
        ],
        fields: [],
      },
    ]);
    console.log("✅ Digital Products catalog seeded");
  }

  // 5. Seed Site & Payment Settings
  await db.insert(settings).values([
    {
      key: "site_config",
      value: {
        siteName: "DELYKASTORE",
        siteDescription: "Premium Digital Subscriptions & Verified Accounts",
        announcementText: "⚡ FLASH SALE: Get 20% OFF all Spotify, YouTube & Netflix subscriptions with code VIRITH20! Instant Delivery 24/7.",
        isAnnouncementActive: true,
        telegramSupport: "@delykastore_support",
        facebookSupport: "https://facebook.com/delykastore",
        isMaintenance: false,
      },
    },
    {
      key: "payment_config",
      value: {
        isPaywayEnabled: true,
        paywayMerchantId: "ec438784",
      },
    },
  ]).onConflictDoNothing();
  console.log("✅ Site & Payment Configuration seeded");

  // 6. Seed Coupons
  const existingCoupons = await db.select().from(coupons).limit(1);
  if (!existingCoupons.length) {
    await db.insert(coupons).values([
      {
        code: "VIRITH20",
        discountType: "percentage",
        discountValue: "20.00",
        minOrderAmount: "3.00",
        maxDiscount: "10.00",
        usageLimit: 500,
        usedCount: 14,
        isActive: true,
      },
      {
        code: "SAVE5",
        discountType: "fixed",
        discountValue: "5.00",
        minOrderAmount: "15.00",
        usageLimit: 200,
        usedCount: 6,
        isActive: true,
      },
      {
        code: "DELYKA10",
        discountType: "percentage",
        discountValue: "10.00",
        minOrderAmount: "1.00",
        usageLimit: 1000,
        usedCount: 22,
        isActive: true,
      },
    ]);
    console.log("✅ Promotional Coupons seeded");
  }

  // 7. Seed Wagering Milestone Rewards
  const existingGifts = await db.select().from(gifts).limit(1);
  if (!existingGifts.length) {
    await db.insert(gifts).values([
      {
        name: "Bronze Mystery Box",
        requiredWagering: "10.00",
        rewardType: "discount",
        rewardValue: "1.00",
        isActive: true,
      },
      {
        name: "Silver Tier Gift Box (Spotify Upgrade)",
        requiredWagering: "25.00",
        rewardType: "product",
        rewardValue: "SPOTIFY-1M-FREE",
        isActive: true,
      },
      {
        name: "Gold VIP Box (Netflix 4K Profile)",
        requiredWagering: "50.00",
        rewardType: "product",
        rewardValue: "NETFLIX-4K-1M",
        isActive: true,
      },
      {
        name: "Diamond Vault Box (Discord Nitro 3M)",
        requiredWagering: "100.00",
        rewardType: "product",
        rewardValue: "NITRO-3M-VIP",
        isActive: true,
      },
    ]);
    console.log("✅ Wagering Milestone Gifts seeded");
  }

  // 8. Seed Spin Wheel Prizes
  const existingPrizes = await db.select().from(spinPrizes).limit(1);
  if (!existingPrizes.length) {
    await db.insert(spinPrizes).values([
      { name: "$1.00 Discount", type: "discount", value: "SPIN1USD", probability: 25, color: "#FF2D55", isActive: true },
      { name: "10% Off Voucher", type: "discount", value: "SPIN10OFF", probability: 20, color: "#FF6B8B", isActive: true },
      { name: "$5.00 Big Win", type: "discount", value: "SPIN5USD", probability: 5, color: "#FFD700", isActive: true },
      { name: "100 Loyalty Points", type: "points", value: "100", probability: 30, color: "#333333", isActive: true },
      { name: "Free Lucky Spin", type: "free_spin", value: "1", probability: 15, color: "#7B2CBF", isActive: true },
      { name: "Mystery Digital Account", type: "product", value: "MYSTERY-ACC", probability: 5, color: "#00B4D8", isActive: true },
    ]);
    console.log("✅ Spin wheel prizes seeded");
  }

  // 9. Seed Promotional Events
  const existingEvents = await db.select().from(events).limit(1);
  if (!existingEvents.length) {
    await db.insert(events).values([
      {
        name: "Netflix 4K Weekend Flash Sale",
        nameKh: "ប្រូម៉ូសិនពិសេស Netflix 4K",
        image: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500&auto=format&fit=crop&q=70",
        eventBanner: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500&auto=format&fit=crop&q=70",
        eventPrice: "$3.99",
        originalPrice: "$5.99",
        productId: "netflix-premium-4k",
        link: "/product/netflix-premium-4k",
        order: 1,
        isActive: true,
      },
      {
        name: "Spotify Annual Upgrade 50% OFF",
        nameKh: "Spotify ប្រចាំឆ្នាំបញ្ចុះតម្លៃ 50%",
        image: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=500&auto=format&fit=crop&q=70",
        eventBanner: "https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=500&auto=format&fit=crop&q=70",
        eventPrice: "$2.50",
        originalPrice: "$4.99",
        productId: "spotify-premium",
        link: "/product/spotify-premium",
        order: 2,
        isActive: true,
      },
      {
        name: "ChatGPT Plus & GPT-4o Instant Access",
        nameKh: "ChatGPT Plus គណនីផ្ទាល់ខ្លួន",
        image: "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=500&auto=format&fit=crop&q=70",
        eventBanner: "https://images.unsplash.com/photo-1677442136019-21780efad99a?w=500&auto=format&fit=crop&q=70",
        eventPrice: "$9.99",
        originalPrice: "$15.00",
        productId: "chatgpt-plus",
        link: "/product/chatgpt-plus",
        order: 3,
        isActive: true,
      },
      {
        name: "Discord Nitro 1 Year + 2 Boosts",
        nameKh: "Discord Nitro 1 ឆ្នាំពេញ",
        image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=70",
        eventBanner: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=70",
        eventPrice: "$4.50",
        originalPrice: "$9.99",
        productId: "discord-nitro",
        link: "/product/discord-nitro",
        order: 4,
        isActive: true,
      },
    ]);
    console.log("✅ Promotional events seeded");
  }

  // 10. Seed Sample Completed Orders (for Live Orders Feed)
  const existingOrders = await db.select().from(orders).limit(1);
  if (!existingOrders.length) {
    const sampleProduct = (await db.select().from(products).limit(1))[0];
    if (sampleProduct) {
      await db.insert(orders).values([
        {
          orderNumber: "1084291",
          userEmail: "customer1@gmail.com",
          productId: sampleProduct.id,
          productName: "Netflix Premium 4K UHD",
          productType: "account",
          packageId: "1",
          packageName: "1 Month Private Profile",
          price: "3.99",
          originalPrice: "3.99",
          status: "completed",
          paymentStatus: "paid",
          paymentMethod: "payway_khqr",
          credentials: {},
          deliveryData: { accessCode: "NETFLIX-PIN-8821" },
        },
        {
          orderNumber: "1084292",
          userEmail: "dara.user@gmail.com",
          productId: sampleProduct.id,
          productName: "Spotify Premium Individual",
          productType: "account",
          packageId: "1",
          packageName: "1 Month Upgrade",
          price: "2.50",
          originalPrice: "2.50",
          status: "completed",
          paymentStatus: "paid",
          paymentMethod: "payway_khqr",
          credentials: {},
          deliveryData: { inviteLink: "https://spotify.com/family/join" },
        },
        {
          orderNumber: "1084293",
          userEmail: "sokha.tech@gmail.com",
          productId: sampleProduct.id,
          productName: "ChatGPT Plus & GPT-4o",
          productType: "account",
          packageId: "1",
          packageName: "1 Month Private Account",
          price: "9.99",
          originalPrice: "9.99",
          status: "completed",
          paymentStatus: "paid",
          paymentMethod: "payway_khqr",
          credentials: {},
          deliveryData: { username: "openai.user99@gpt.com" },
        },
        {
          orderNumber: "1084294",
          userEmail: "gamer_pro@gmail.com",
          productId: sampleProduct.id,
          productName: "Discord Nitro + 2 Boosts",
          productType: "digital-service",
          packageId: "1",
          packageName: "1 Month Nitro Gift Link",
          price: "4.50",
          originalPrice: "4.50",
          status: "completed",
          paymentStatus: "paid",
          paymentMethod: "payway_khqr",
          credentials: {},
          deliveryData: { giftUrl: "https://discord.gift/ab8291f" },
        },
      ]);
      console.log("✅ Live orders feed seeded");
    }
  }

  console.log("🎉 Complete database seeding finished successfully!");
  process.exit(0);
}


seed().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});

