// Custom entry: define the notification background task BEFORE expo-router
// takes over. Android launches this bundle headless for background polling,
// and TaskManager.defineTask must have run by then.
import './src/notifications';
import 'expo-router/entry';
