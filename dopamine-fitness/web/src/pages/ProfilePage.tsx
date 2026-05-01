import { useState, useEffect } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useMe, usePatchMe } from "../features/auth/useAuth";

export function ProfilePage() {
  const { data, isLoading } = useMe();
  const patchMe = usePatchMe();

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (data) {
      setUsername(data.username ?? "");
      setBio(data.profile?.bio ?? "");
    }
  }, [data]);

  function handleSave() {
    patchMe.mutate(
      { username, bio },
      { onSuccess: () => setEditing(false) }
    );
  }

  return (
    <Card>
      <h2>Профиль</h2>
      {isLoading ? (
        <p className="text-muted">Загрузка...</p>
      ) : (
        <div className="stack">
          {/* Avatar */}
          <div className="profile-avatar-wrap">
            {data?.profile?.avatar_url ? (
              <img
                src={data.profile.avatar_url}
                alt="avatar"
                className="profile-avatar"
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {(data?.username ?? "?")[0].toUpperCase()}
              </div>
            )}
          </div>

          {editing ? (
            <div className="stack">
              <label className="form-label">
                Имя пользователя
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={40}
                />
              </label>
              <label className="form-label">
                О себе
                <textarea
                  className="input"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={300}
                  style={{ resize: "vertical" }}
                />
              </label>
              <div className="row">
                <Button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={patchMe.isPending}
                >
                  {patchMe.isPending ? "Сохранение..." : "Сохранить"}
                </Button>
                <Button className="btn-ghost" onClick={() => setEditing(false)}>
                  Отмена
                </Button>
              </div>
              {patchMe.isError && (
                <p className="text-error">Ошибка сохранения</p>
              )}
            </div>
          ) : (
            <div className="stack">
              <div className="profile-info-row">
                <span className="profile-info-label">Email</span>
                <span className="profile-info-value">{data?.email}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Username</span>
                <span className="profile-info-value">{data?.username}</span>
              </div>
              {data?.profile?.bio && (
                <div className="profile-info-row">
                  <span className="profile-info-label">О себе</span>
                  <span className="profile-info-value">{data.profile.bio}</span>
                </div>
              )}
              <div className="profile-info-row">
                <span className="profile-info-label">Роль</span>
                <span className="profile-info-value profile-badge">{data?.role}</span>
              </div>
              <Button className="btn-ghost" onClick={() => setEditing(true)}>
                ✏️ Редактировать
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
