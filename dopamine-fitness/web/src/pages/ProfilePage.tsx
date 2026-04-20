import { Card } from "../components/ui/Card";
import { useMe } from "../features/auth/useAuth";

export function ProfilePage() {
  const { data, isLoading } = useMe();

  return (
    <Card>
      <h2>Профиль</h2>
      {isLoading ? <p>Загрузка...</p> : (
        <>
          <p>ID: {data?.id}</p>
          <p>Email: {data?.email}</p>
          <p>Username: {data?.username}</p>
        </>
      )}
    </Card>
  );
}
