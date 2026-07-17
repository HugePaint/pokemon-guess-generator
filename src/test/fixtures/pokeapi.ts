export const speciesBundleFixture = {
  species: {
    id: 25,
    name: "pikachu",
    names: [
      { language: { name: "zh-Hans" }, name: "皮卡丘" },
      { language: { name: "en" }, name: "Pikachu" },
    ],
    varieties: [
      {
        is_default: true,
        pokemon: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon/25/" },
      },
    ],
  },
  pokemon: {
    id: 25,
    name: "pikachu",
    sprites: {
      front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
      front_female: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/female/25.png",
      other: {
        home: {
          front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/25.png",
          front_female: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/female/25.png",
        },
        "official-artwork": {
          front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
        },
      },
    },
  },
  forms: [
    {
      id: 10080,
      name: "pikachu-cap-partner",
      form_name: "cap-partner",
      is_default: false,
      is_mega: false,
      is_battle_only: false,
      pokemon: { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon/25/" },
      names: [
        { language: { name: "zh-Hans" }, name: "搭档帽皮卡丘" },
        { language: { name: "en" }, name: "Pikachu Partner Cap" },
      ],
      sprites: {
        front_default: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/25-cap-partner.png",
      },
    },
  ],
} as const;

const legendaryModeAliases = [
  { id: 10264, name: "koraidon-limited-build", formName: "limited-build" },
  { id: 10265, name: "koraidon-sprinting-build", formName: "sprinting-build" },
  { id: 10266, name: "koraidon-swimming-build", formName: "swimming-build" },
  { id: 10267, name: "koraidon-gliding-build", formName: "gliding-build" },
  { id: 10268, name: "miraidon-low-power-mode", formName: "low-power-mode" },
  { id: 10269, name: "miraidon-drive-mode", formName: "drive-mode" },
  { id: 10270, name: "miraidon-aquatic-mode", formName: "aquatic-mode" },
  { id: 10271, name: "miraidon-glide-mode", formName: "glide-mode" },
] as const;

export const legendaryModeAliasesFixture = {
  species: {
    id: 1007,
    name: "legendary-mode-aliases",
    names: [
      { language: { name: "zh-Hans" }, name: "传说形态别名" },
      { language: { name: "en" }, name: "Legendary mode aliases" },
    ],
    varieties: legendaryModeAliases.map(({ name }) => ({
      is_default: false,
      pokemon: { name },
    })),
  },
  pokemon: {
    id: 10264,
    name: "koraidon-limited-build",
    sprites: { front_default: null },
  },
  varietyPokemon: legendaryModeAliases.map(({ id, name }) => ({
    id,
    name,
    sprites: { front_default: null },
  })),
  forms: legendaryModeAliases.map(({ name, formName }) => ({
    name,
    form_name: formName,
    is_default: false,
    is_mega: false,
    is_battle_only: false,
    pokemon: { name },
    names: [],
    sprites: { front_default: null },
  })),
};
