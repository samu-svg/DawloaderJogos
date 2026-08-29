/**
 * Official Xbox 360 marketplace boxarts by Title ID.
 * URL: https://download-ssl.xbox.com/content/images/66acd000-77fe-1000-9115-d802{titleId}/1033/boxartlg.jpg
 */
export function xbox360CoverUrl(titleId) {
  return `https://download-ssl.xbox.com/content/images/66acd000-77fe-1000-9115-d802${titleId.toLowerCase()}/1033/boxartlg.jpg`;
}

/** Main jogos360 entries → Xbox 360 Title ID. Mario 64 is homebrew (no official 360 box). */
export const GAME_TITLE_IDS = {
  "a1b2c3d1-0001-4000-8000-000000000001": "4D530805", // Alan Wake
  "fd15402e-ff80-4168-9a12-561c2b24f690": "45410916", // Alice Madness Returns
  "50404115-5961-4fb8-8314-64e2c37b949c": "43430817", // Asura's Wrath
  "a1b2c3d1-0001-4000-8000-000000000002": "5553083C", // Avatar: The Game
  "0702f186-bb06-4a5e-851d-ad605163e147": "443607D6", // Back to the Future
  "c025ac83-ec12-4141-a0ae-efec96b28801": "545107EF", // Baja Edge of Control
  "246f78c3-edc5-415b-956f-d118c17ebc99": "373407DB", // Barbie Puppy Rescue
  "a1b2c3d1-0001-4000-8000-000000000003": "53450813", // Bayonetta
  "477f0f06-f1d1-4a5b-88fe-df07974a5514": "415607F5", // Bee Movie
  "52e06ece-ffcf-42b8-bd51-fd0fcaf94f5b": "54510850", // SpongeBob Truth or Square
  "f73b47c6-f33a-40ee-b532-3cec198ec752": "454108C5", // Brutal Legend
  "d80f6c03-e072-4cfe-9d44-1ca5037cdd0a": "415607E6", // COD 4
  "3271e47f-3c82-4548-a7ac-74879e499dfe": "41560855", // COD Black Ops
  "a1b2c3d1-0001-4000-8000-000000000004": "53450858", // Captain America Super Soldier
  "d9241d79-cac3-4ea5-9310-3a268e2ad358": "454109D4", // FIFA World Cup 2014
  "a1b2c3d1-0001-4000-8000-000000000005": "565507FA", // Crash Mind over Mutant
  "a1b2c3d1-0001-4000-8000-000000000006": "454108E3", // Crysis 2
  "6f6264fa-4acb-4df4-94fb-52c96d8f48fa": "4B4D07DF", // Dead Island
  "a1b2c3d1-0001-4000-8000-000000000007": "45410857", // Dead Space
  "df92d381-515f-43c0-ad42-cc75164fb7a8": "434307DF", // DMC 4
  "e9f69fad-1824-4796-ac36-1efe7f6d57ba": "4343081E", // DMC HD Collection
  "5e4ed040-46c5-44d9-a197-32f131cd9823": "434D083D", // DiRT 3
  "79faa2f3-ee5b-4832-aaca-294e5f93ccda": "43430824", // DmC
  "c5cf14dd-326c-4d84-8967-a9fdf2082323": "4541090B", // Dragon Age 2
  "4ef233c7-66e5-4376-b768-cf7f94f13c82": "4E4D0856", // DBZ Budokai HD Collection
  "a1b2c3d1-0001-4000-8000-000000000008": "4E4D0860", // DBZ Battle of Z
  "9c6113be-30d3-428c-9afa-738f6b24f200": "424107DC", // DBZ Burst Limit
  "42d2f8f8-e7ba-4128-82a4-e20acea35a07": "4E4D0846", // DBZ Ultimate Tenkaichi
  "ef873916-e26c-44ff-9c1b-d8187f315538": "4E4D0803", // Raging Blast
  "586ba480-2894-4211-92a4-359a1a3c2e2e": "4E4D0826", // Raging Blast 2
  "b75ed1ff-bf92-4e1c-9320-1746dd781002": "4E4D07F1", // Enslaved
  "c3effe68-85b7-4195-973a-485cef967863": "55530810", // Far Cry 2
  "1ba41a65-c189-4b1f-8043-68d7c9af2b39": "454107D7", // FIFA 06 RTFWC
  "c3dbe2a1-43e6-4910-bf40-f4af8a1c41be": "454109DB", // FIFA 15
  "5f202930-2e60-4d33-84dc-786bf6dbfd8b": "454109F9", // FIFA 19 Legacy
  "d0195c32-9bb5-48d0-af1c-6a8eb15c2ac3": "4541083B", // FIFA Street 3
  "f9b7c88c-eb29-4bf2-9fca-5f9553fb5c06": "45410894", // Fight Night Round 4
  "54d79674-fa72-49e1-a836-a8fc9138a6cc": "425607E8", // G-Force
  "a1b2c3d1-0001-4000-8000-000000000009": "4D53082D", // Gears 2
  "a1b2c3d1-0001-4000-8000-000000000010": "4D5308AB", // Gears 3
  "a1b2c3d1-0001-4000-8000-000000000011": "4D5307D5", // Gears 1
  "2820c254-3d69-4948-a074-6b17dd66b68b": "4541080F", // Orange Box
  "269309c9-e77c-44ac-b3a1-b3c65ccb93fd": "45410819", // Harry Potter OOTP
  "e379928c-7260-43cc-86f6-707c276cdcd0": "534307DB", // Hitman Blood Money
  "5185be31-d966-4c34-9e79-68266a1cd0bb": "57520838", // Hot Wheels World's Best Driver
  "57a108e4-1a79-401c-8477-f2cb21a218b1": "5841147C", // Life is Strange
  "847b5032-0c7b-42da-8824-b87295e06f6a": "53450843", // London 2012
  "bbbd64bc-ab71-4827-af80-fcb98b19c183": "545407E6", // Mafia II
  "a1b2c3d1-0001-4000-8000-000000000013": "4156082F", // Marvel Ultimate Alliance 2
  "48742df4-917c-4ca2-bf8d-81217142b6d2": "454108F7", // Medal of Honor 2010
  "4235a623-3cd5-42bc-9825-5e82e652a028": "454107F6", // Medal of Honor Airborne
  "76ed2aa2-1838-423a-98f2-a768396c477e": "54510842", // Metro 2033
  "a1b2c3d1-0001-4000-8000-000000000014": "535107F1", // Mindjack
  "a1b2c3d1-0001-4000-8000-000000000015": "4D5707E9", // MK vs DC
  "d412001a-473c-406d-9bf1-1208060083c3": "4A3007D3", // PES 2018
  "b78e07fc-5d14-450e-8f31-69c649f61563": "58410960", // Portal Still Alive
  "cb2e042f-a2c7-442a-a1b5-17ca59bd9f54": "4B4E0801", // PES 2010
  "3f3c66d7-70ec-4a2d-9d01-ca328a84dff0": "4B4E0856", // PES 2014
  "a1b2c3d1-0001-4000-8000-000000000016": "43430841", // Resident Evil HD
  "d54271fe-7acf-4d92-b842-4d34eeaeeb2d": "4E4D07D3", // Ridge Racer 6
  "a1b2c3d1-0001-4000-8000-000000000017": "54510875", // Rio
  "7640ad45-40d7-4cae-80b5-33db3ac23b78": "4B4E07D1", // Rumble Roses XX
  "d0c95662-1743-4a6b-93e9-17d2b63f9ed6": "5451086D", // Saints Row The Third
  "8f29db94-f564-4f61-8b1b-0d6ec578c8bb": "4541087F", // Skate 2
  "6e66d037-ad3b-45cd-83c8-f075ca64f6b9": "53450812", // Sonic Unleashed
  "a1b2c3d1-0001-4000-8000-000000000018": "4E4D083D", // Soul Calibur V
  "a1b2c3d1-0001-4000-8000-000000000019": "415607FA", // Spider-Man Friend or Foe
  "a1b2c3d1-0001-4000-8000-00000000001a": "555307D7", // Splinter Cell Double Agent
  "06d1e7a2-cc2d-434b-aead-8b57d8c934f7": "4C4107F2", // TFU 2
  "da29129a-5f20-42cb-b1c6-4a0ff4791921": "4C4107D2", // TFU Ultimate Sith
  "1add183b-1a23-46f9-b328-8f4b9d4a9539": "444507D5", // Stoked Big Air
  "a1b2c3d1-0001-4000-8000-00000000001b": "4343080F", // Street Fighter X Tekken
  "a1b2c3d1-0001-4000-8000-00000000001c": "454107ED", // Superman Returns
  "a1b2c3d1-0001-4000-8000-00000000001d": "4E4D07FC", // Tekken 6
  "60fa9ace-ed97-429f-8180-47429ad0b25d": "455607D5", // Terminator Salvation
  "a1b2c3d1-0001-4000-8000-00000000001e": "41560905", // Amazing Spider-Man 2
  "2972274c-8ff5-4ae5-9499-51d5432bc497": "425607DB", // Narnia Prince Caspian
  "a1b2c3d1-0001-4000-8000-00000000001f": "534507F1", // Incredible Hulk
  "a1b2c3d1-0001-4000-8000-000000000012": "534E07DC", // KOF XIII
  "a1b2c3d1-0001-4000-8000-000000000020": "565507F9", // Spyro Dawn of the Dragon
  "a1b2c3d1-0001-4000-8000-000000000021": "4541088F", // The Saboteur
  "a1b2c3d1-0001-4000-8000-000000000022": "45410809", // The Simpsons Game
  "99fe1ebf-b9ae-4105-8e00-0c41aa4f6497": "555308BD", // The Smurfs 2
  "a1b2c3d1-0001-4000-8000-000000000023": "584111DE", // Walking Dead
  "9a924ed9-2d51-49f9-97b0-338b58c23411": "454109D0", // Titanfall
  "5edade5f-382c-4a10-893d-2bd7e95afb86": "584109D2", // TMNT Re-Shelled
  "a1b2c3d1-0001-4000-8000-000000000024": "534307EC", // Tomb Raider Underworld
  "5f217943-5a06-4ba5-b796-c6f285679da4": "54540859", // Top Spin 4
  "090d0775-1047-4d72-8514-a4a5bd090387": "4156089C", // Transformers Fall of Cybertron
  "0403964f-a497-467a-9fcd-81b9ab127409": "425607D3", // Turok
  "6e8fde22-d682-45ef-a2ba-1789b232b3ef": "5451087D", // UFC Undisputed 3
  "a1b2c3d1-0001-4000-8000-000000000025": "5451082C", // Space Marine
  "a1b2c3d1-0001-4000-8000-000000000026": "415607DE", // Wolfenstein
};
