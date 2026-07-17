export function LegalNotice() {
  return (
    <aside className="legal-notice" aria-label="版权与来源说明">
      <p>
        本工具是非官方、非商业的粉丝创作，与 The Pokémon Company、Nintendo、
        Game Freak 或 Creatures 无隶属关系，亦未获得其授权或认可。宝可梦及相关
        名称、角色和素材的权利归 The Pokémon Company 及相应权利人所有。图鉴数据
        来源于{" "}
        <a href="https://pokeapi.co/" target="_blank" rel="noreferrer">
          PokéAPI
        </a>
        ，图片素材来源于{" "}
        <a
          href="https://github.com/PokeAPI/sprites"
          target="_blank"
          rel="noreferrer"
        >
          PokeAPI sprites
        </a>
        。
      </p>
    </aside>
  );
}
