import HomePage from "./routes/homePage/homePage";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Layout, RequireAuth } from "./routes/layout/layout";
import Login from "./routes/login/login";
import Register from "./routes/register/register";
import Pothole from "./routes/pothole/pothole";
import Complaint from "./routes/complaint/complaint";
import Analysis from "./routes/analysis/analysis";
import Redeem from "./routes/redeem/redeem";
import Event from "./routes/event/event";
import AdminDashboard from "./routes/admin/adminDashboard";
import AdminAnalytics from "./routes/adminAnalytics/adminAnalytics";
import AdminPredictions from "./routes/adminPredictions/adminPredictions";
import PotholeDisplay from "./routes/potholeDisplay/potholeDisplay";
import ComplaintDisplay from "./routes/complaintDisplay/complaintDisplay";
import UserDisplay from "./routes/userDisplay/userDisplay";
import RouteHistory from "./routes/routeHistory/routeHistory";
import CalendarApp from "./routes/trafficCalendar/trafficCalendar";
import TrafficStatus from "./routes/trafficStatus/trafficStatus";
import LineScoreDate from "./routes/linescoredate/lineScoreDate";
import LineWeekDay from "./routes/lineweekday/lineWeekDay";
import TrafficPrediction from "./routes/trafficPrediction/trafficPrediction";
import RouteComparison from "./routes/routeComparison/routeComparison";
import ConstructionTimeline from "./routes/constructionTimeline/constructionTimeline";

function App() {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <Layout />,
      children: [
        {
          path: "/", // HomePage
          element: <HomePage />,
        },
        {
          path: "/login", 
          element: <Login />,
        },
        {
          path: "/register", // Relative path
          element: <Register />,
        },
      ],
    },
    {
      element: <RequireAuth />, // Authenticated routes
      children: [
        {
          path: "/pothole", 
          element: <Pothole />,
        },
        {
          path: "/complaint", // Relative path
          element: <Complaint />,
        },
        {
          path: "/analysis", // Relative path
          element: <Analysis />,
        },
        {
          path: "/redeem", // Relative path
          element: <Redeem />,
        },
        {
          path: "/event", // Relative path
          element: <Event />,
        },
        {
          path: "/route-history", // RouteHistory
          element: <RouteHistory />
        },
        {
          path: "/predictive-analysis",
          element:<TrafficPrediction/>
        },
        {
          path: "/traffic-calendar", 
          element: <CalendarApp/>
        },
        {
          path: "/festival-analysis", 
          element: <LineScoreDate/>
        },
        {
          path: "/last-four-week", 
          element: <LineWeekDay/ >
        },
        {
          path: "/traffic-status",
          element: <TrafficStatus/> 
        },
        {
          path: "/route-comparison",
          element: <RouteComparison />
        }
      ],
    },
    {
      path: "admin", // Admin base route
      element: <RequireAuth requiredRole="admin" />, // Restrict admin routes
      children: [
        {
          path: "", // AdminDashboard (default child route)
          element: <AdminDashboard />,
        },
        {
          path: "analytics", // Analytics Dashboard
          element: <AdminAnalytics />,
        },
        {
          path: "predictions", // Prediction Accuracy Dashboard
          element: <AdminPredictions />,
        },
        {
          path: "potholes", // PotholeDisplay
          element: <PotholeDisplay />,
        },
        {
          path: "complaints", // ComplaintDisplay
          element: <ComplaintDisplay />,
        },
        {
          path: "users", // UserDisplay
          element: <UserDisplay />,
        },
        {
          path: "construction-timeline",
          element: <ConstructionTimeline />,
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

export default App;
