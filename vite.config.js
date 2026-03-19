import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const htmlInputs = {
	main: "index.html",
	login: "scripts/pages/login/login.html",
	studentLibrary: "scripts/pages/student-library/student-library.html",
	teacherDashboard: "scripts/pages/teacher-dashboard/teacher-dashboard.html",
	teacherPlanDashboard: "scripts/pages/teacher-plan-dashboard/teacher-plan-dashboard.html",
	lessonPlayer: "scripts/pages/lesson-player/lesson-player.html",
	pdfReader: "scripts/pages/pdf-reader/pdf-reader.html",
	teamShowcase: "scripts/pages/team-showcase/team-showcase.html",
	studentProfile: "scripts/pages/student-profile/student-profile.html"
};

const rollupInput = Object.fromEntries(
	Object.entries(htmlInputs).map(([name, path]) => [name, fileURLToPath(new URL(path, import.meta.url))])
);

export default defineConfig({
	build: {
		rollupOptions: {
			input: rollupInput
		}
	}
});
