"use client";

// ManualInputsForm.tsx — Controlled form for all six manual operational inputs plus
// the optional facility-name override.
//
// Design constraints:
//   D-11: All controls receive disabled={disabled} — disabled until the first successful fetch.
//   D-12: currentCensus is the ONLY numeric field (<input type="number">); all others are text/select.
//   PREV-01: onChange fires on every keystroke so the parent re-assembles the view-model
//             and the preview updates live with no debounce (Phase 7 adds debounce).
//   NAME-02: nameOverride is a body-only override — it never touches the static header block.
//             The restriction is enforced in assembleViewModel; this form just binds the field.
//   Merge-update: each onChange calls onChange({ ...inputs, <field>: value }) so one field
//                 never clobbers another.
//   T-03-10: All values rendered via React JSX (auto-escaped); no dangerouslySetInnerHTML.
//   T-03-11: currentCensus uses e.target.valueAsNumber || null — non-numeric entry resolves
//            to null rather than NaN propagating into the model.

import type { ManualInputs } from "@/lib/report/view-model";

interface Props {
  inputs: ManualInputs;
  onChange: (next: ManualInputs) => void;
  /** D-11: disabled until the first successful facility fetch. */
  disabled: boolean;
}

/**
 * Renders controlled inputs for all six manual operational fields plus the name override.
 *
 * Fields (in report body order):
 *   1. Name Override  (text — body "Name of Facility" only, NAME-02)
 *   2. EMR            (text)
 *   3. Current Census (number — the ONLY numeric field, D-12)
 *   4. Type of Patient (text)
 *   5. Previous Coverage from Medelite (Yes/No select)
 *   6. Previous Provider Performance (text)
 *   7. Medical Coverage (free text — its own field, NOT part of Medelite History)
 */
export function ManualInputsForm({ inputs, onChange, disabled }: Props) {
  return (
    <fieldset
      disabled={disabled}
      className="space-y-3 border border-zinc-200 rounded-lg p-4 bg-white"
    >
      <legend className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">
        Operational Inputs
      </legend>

      {/* Name Override — affects body "Name of Facility" only (NAME-02) */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-zinc-600"
          htmlFor="mi-nameOverride"
        >
          Name Override
        </label>
        <input
          id="mi-nameOverride"
          type="text"
          value={inputs.nameOverride ?? ""}
          onChange={(e) =>
            onChange({ ...inputs, nameOverride: e.target.value })
          }
          disabled={disabled}
          placeholder="Leave blank to use CMS name"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400"
        />
      </div>

      {/* EMR — text */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600" htmlFor="mi-emr">
          EMR
        </label>
        <input
          id="mi-emr"
          type="text"
          value={inputs.emr ?? ""}
          onChange={(e) => onChange({ ...inputs, emr: e.target.value })}
          disabled={disabled}
          placeholder="e.g. PointClickCare"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400"
        />
      </div>

      {/* Current Census — numeric (the ONLY numeric field, D-12; T-03-11) */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-zinc-600"
          htmlFor="mi-currentCensus"
        >
          Current Census
        </label>
        <input
          id="mi-currentCensus"
          type="number"
          value={inputs.currentCensus ?? ""}
          onChange={(e) =>
            onChange({
              ...inputs,
              currentCensus: e.target.valueAsNumber || null,
            })
          }
          disabled={disabled}
          placeholder="e.g. 130"
          min={0}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400"
        />
      </div>

      {/* Type of Patient — text */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-zinc-600"
          htmlFor="mi-typeOfPatient"
        >
          Type of Patient
        </label>
        <input
          id="mi-typeOfPatient"
          type="text"
          value={inputs.typeOfPatient ?? ""}
          onChange={(e) =>
            onChange({ ...inputs, typeOfPatient: e.target.value })
          }
          disabled={disabled}
          placeholder="e.g. SNF, ALF"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400"
        />
      </div>

      {/* Previous Coverage from Medelite — Yes/No select */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-zinc-600"
          htmlFor="mi-previousCoverage"
        >
          Previous Coverage from Medelite
        </label>
        <select
          id="mi-previousCoverage"
          value={inputs.previousCoverage ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...inputs,
              previousCoverage: v === "Yes" || v === "No" ? v : null,
            });
          }}
          disabled={disabled}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400"
        >
          <option value="">—</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>

      {/* Previous Provider Performance — text */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-zinc-600"
          htmlFor="mi-previousProviderPerformance"
        >
          Previous Provider Performance
        </label>
        <input
          id="mi-previousProviderPerformance"
          type="text"
          value={inputs.previousProviderPerformance ?? ""}
          onChange={(e) =>
            onChange({ ...inputs, previousProviderPerformance: e.target.value })
          }
          disabled={disabled}
          placeholder="e.g. Strong outcomes"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400"
        />
      </div>

      {/* Medical Coverage — free-text (its own field, NOT part of Medelite History) */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-zinc-600"
          htmlFor="mi-medicalCoverage"
        >
          Medical Coverage
        </label>
        <input
          id="mi-medicalCoverage"
          type="text"
          value={inputs.medicalCoverage ?? ""}
          onChange={(e) =>
            onChange({ ...inputs, medicalCoverage: e.target.value })
          }
          disabled={disabled}
          placeholder="e.g. Optometry, PCP, Podiatry"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400"
        />
      </div>
    </fieldset>
  );
}
