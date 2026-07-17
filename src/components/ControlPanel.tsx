import type { ChangeEvent } from "react";
import type { GeneratorController } from "../features/generator/use-generator";
import { getFormDisplayName } from "../features/selection/display-name";

export interface ControlPanelProps {
  readonly controller: GeneratorController;
}

export function ControlPanel({ controller }: ControlPanelProps) {
  const loading = controller.status.type === "loading-image";
  const selectedSpecies = controller.selection?.species;

  const handleSpeciesChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const species = controller.manifest.species.find(
      (candidate) => candidate.slug === event.target.value,
    );
    if (species !== undefined) {
      void controller.selectSpecies(species);
    }
  };

  const handleFormChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const form = selectedSpecies?.forms.find(
      (candidate) => candidate.id === event.target.value,
    );
    if (form !== undefined) {
      void controller.selectForm(form);
    }
  };

  return (
    <section className="panel control-panel" aria-labelledby="controls-title">
      <h2 id="controls-title">生成设置</h2>
      <div className="field">
        <label htmlFor="pokemon-search">搜索宝可梦</label>
        <input
          id="pokemon-search"
          type="search"
          value={controller.search}
          onChange={(event) => controller.setSearch(event.target.value)}
          placeholder="中文名、英文名或编号"
          autoComplete="off"
        />
        {controller.search.trim() !== "" && controller.searchResults.length > 0 && (
          <ul className="search-results" role="listbox" aria-label="搜索结果">
            {controller.searchResults.map((species) => (
              <li key={species.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedSpecies?.id === species.id}
                  onClick={() => void controller.selectSpecies(species)}
                >
                  {species.names.zhHans} / {species.names.en} · No.
                  {String(species.id).padStart(4, "0")}
                </button>
              </li>
            ))}
          </ul>
        )}
        {controller.searchMessage !== "" && (
          <p className="field-message" role="status">
            {controller.searchMessage}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="species-select">宝可梦</label>
        <select
          id="species-select"
          value={selectedSpecies?.slug ?? ""}
          onChange={handleSpeciesChange}
          disabled={loading}
        >
          <option value="" disabled>请选择</option>
          {controller.manifest.species.map((species) => (
            <option key={species.id} value={species.slug}>
              {species.names.zhHans} / {species.names.en}
            </option>
          ))}
        </select>
      </div>

      {selectedSpecies !== undefined && selectedSpecies.forms.length > 1 && (
        <div className="field">
          <label htmlFor="form-select">形态</label>
          <select
            id="form-select"
            value={controller.selection?.form.id ?? ""}
            onChange={handleFormChange}
            disabled={loading}
          >
            {selectedSpecies.forms.map((form) => (
              <option key={form.id} value={form.id}>
                {getFormDisplayName(form)}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        className="primary-button"
        type="button"
        onClick={() => void controller.randomize()}
        disabled={loading}
      >
        随机选择
      </button>

      <fieldset className="mode-fieldset" disabled={controller.selection === null}>
        <legend>题面模式</legend>
        <label>
          <input
            type="radio"
            name="question-mode"
            value="silhouette"
            checked={controller.mode === "silhouette"}
            onChange={() => controller.setMode("silhouette")}
          />
          黑色剪影
        </label>
        <label>
          <input
            type="radio"
            name="question-mode"
            value="crop"
            checked={controller.mode === "crop"}
            onChange={() => controller.setMode("crop")}
          />
          区域裁剪
        </label>
      </fieldset>

      {controller.mode === "crop" && controller.crop !== null && (
        <div className="crop-controls">
          <div className="field">
            <div className="range-heading">
              <label htmlFor="crop-zoom">缩放</label>
              <output aria-label="当前缩放">{controller.zoom.toFixed(1)}×</output>
            </div>
            <input
              id="crop-zoom"
              type="range"
              min="1.5"
              max="3"
              step="0.1"
              value={controller.zoom}
              onChange={(event) => controller.setZoom(Number(event.target.value))}
            />
          </div>
          <button type="button" onClick={controller.randomizeCrop}>
            重新随机裁剪
          </button>
          <p className="hint">可在预览图上拖动调整裁剪位置。</p>
        </div>
      )}
    </section>
  );
}
