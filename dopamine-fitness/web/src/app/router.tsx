import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";

const HomePage = lazy(() => import("../pages/HomePage").then((m) => ({ default: m.HomePage })));
const AuthPage = lazy(() => import("../pages/AuthPage").then((m) => ({ default: m.AuthPage })));
const DashboardPage = lazy(() => import("../pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const WorkoutsPage = lazy(() => import("../pages/WorkoutsPage").then((m) => ({ default: m.WorkoutsPage })));
const WorkoutDetailsPage = lazy(() => import("../pages/WorkoutDetailsPage").then((m) => ({ default: m.WorkoutDetailsPage })));
const WorkoutBuilderPage = lazy(() => import("../pages/WorkoutBuilderPage").then((m) => ({ default: m.WorkoutBuilderPage })));
const ExerciseCatalogPage = lazy(() => import("../pages/ExerciseCatalogPage").then((m) => ({ default: m.ExerciseCatalogPage })));
const ExerciseDetailsPage = lazy(() => import("../pages/ExerciseDetailsPage").then((m) => ({ default: m.ExerciseDetailsPage })));
const MyExercisesPage = lazy(() => import("../pages/MyExercisesPage").then((m) => ({ default: m.MyExercisesPage })));
const CalendarPage = lazy(() => import("../pages/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const AdminPage = lazy(() => import("../pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const SettingsPage = lazy(() => import("../pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const ProfilePage = lazy(() => import("../pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const ReportPage = lazy(() => import("../pages/ReportPage").then((m) => ({ default: m.ReportPage })));

export function AppRouter() {
  return (
    <Suspense fallback={<div className="route-loading">Загрузка...</div>}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="auth" element={<AuthPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="workouts" element={<WorkoutsPage />} />
          <Route path="workouts/new" element={<WorkoutBuilderPage />} />
          <Route path="workouts/:id" element={<WorkoutDetailsPage />} />
          <Route path="exercises" element={<ExerciseCatalogPage />} />
          <Route path="exercises/:id" element={<ExerciseDetailsPage />} />
          <Route path="my-exercises" element={<MyExercisesPage />} />
          <Route path="progress" element={<Navigate to="/report" replace />} />
          <Route path="report" element={<ReportPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
