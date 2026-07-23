import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchVisibleWordSets, type VisibleWordSet } from "../lib/wordsets";
import { deleteCustomSet, hideBuiltinSet, parseWordSetJSON, upsertCustomSet } from "../lib/customSets";
import { loadStats, removeSetData } from "../lib/storage";

export default function SettingsPage() {
  const [sets, setSets] = useState<VisibleWordSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    fetchVisibleWordSets()
      .then(setSets)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function addWordSet(raw: string) {
    try {
      const parsed = parseWordSetJSON(JSON.parse(raw));
      const collidesWithBuiltin = sets?.some(
        (item) => item.origin === "builtin" && item.set.id === parsed.id,
      );
      if (collidesWithBuiltin) {
        throw new Error(
          `"${parsed.id}"는 이미 기본 제공 세트의 id입니다. JSON의 "id" 값을 다른 값으로 바꿔주세요.`,
        );
      }
      upsertCustomSet(parsed);
      setAddError(null);
      setPasteText("");
      refresh();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "JSON을 처리하지 못했습니다.");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then(addWordSet)
      .finally(() => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      });
  }

  function handlePasteSubmit() {
    if (!pasteText.trim()) return;
    addWordSet(pasteText);
  }

  function handleDelete(item: VisibleWordSet) {
    const ok = window.confirm(
      `정말 "${item.set.name}" 세트를 삭제할까요? 학습 기록도 함께 삭제됩니다.`,
    );
    if (!ok) return;

    if (item.origin === "custom") deleteCustomSet(item.set.id);
    else hideBuiltinSet(item.set.id);
    removeSetData(item.set.id);
    refresh();
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="btn-secondary">
          ← 목록
        </Link>
        <h1>설정</h1>
      </header>

      {error && <p className="error">{error}</p>}

      <section>
        <h2>단어 세트 추가</h2>
        <div className="add-set-panel">
          <label className="btn-secondary file-upload-label">
            JSON 파일 업로드
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileChange}
              hidden
            />
          </label>

          <textarea
            className="paste-textarea"
            placeholder="또는 단어 세트 JSON을 붙여넣으세요"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
          />
          <button type="button" className="btn-primary" onClick={handlePasteSubmit}>
            붙여넣은 JSON 추가
          </button>

          {addError && <p className="error">{addError}</p>}
        </div>
      </section>

      <section>
        <h2>등록된 단어 세트</h2>
        {!sets && <p>불러오는 중...</p>}
        {sets && sets.length === 0 && <p className="empty-state">등록된 세트가 없습니다.</p>}

        <ul className="set-list">
          {sets?.map((item) => {
            const stats = loadStats(item.set.id);
            return (
              <li key={item.set.id} className="set-list-row">
                <div className="set-list-info">
                  <strong>{item.set.name}</strong>
                  <span className="set-meta">
                    {item.set.cards.length}개 카드
                    {item.origin === "custom" ? " · 사용자 추가" : " · 기본 제공"}
                  </span>
                  <span className="set-meta">
                    총 학습 {stats.totalReviews}회
                    {stats.lastStudiedDate ? ` · 마지막 학습 ${stats.lastStudiedDate}` : " · 학습 기록 없음"}
                  </span>
                </div>
                <button type="button" className="btn-danger" onClick={() => handleDelete(item)}>
                  삭제
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
