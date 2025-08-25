import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { Provider as PaperProvider } from "react-native-paper"
import { StatusBar } from "react-native"

// Contextos
import { AuthProvider } from "./src/context/AuthContext"
import { SyncProvider } from "./src/context/SyncContext"

// Pantallas
import LoginScreen from "./src/screens/auth/LoginScreen"
import SurveyDetailScreen from "./src/screens/surveys/SurveyDetailScreen"
import CollectDataScreen from "./src/screens/surveys/CollectDataScreen"
import SyncScreen from "./src/screens/sync/SyncScreen"
import ProfileScreen from "./src/screens/auth/ProfileScreen"

// Navegación
import type { RootStackParamList } from "./src/models/types"
import MainTabNavigator from "./src/navigation/MainTabNavigator"

const Stack = createNativeStackNavigator<RootStackParamList>()

const App = () => {
  return (
    <SafeAreaProvider>
      <PaperProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <AuthProvider>
          <SyncProvider>
            <NavigationContainer>
              <Stack.Navigator initialRouteName="Login">
                <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
                <Stack.Screen
                  name="SurveyDetail"
                  component={SurveyDetailScreen}
                  options={{ title: "Detalles de Encuesta" }}
                />
                <Stack.Screen
                  name="CollectData"
                  component={CollectDataScreen}
                  options={{ title: "Recolectar Datos" }}
                />
                <Stack.Screen name="Sync" component={SyncScreen} options={{ title: "Sincronización" }} />
                <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Mi Perfil" }} />
              </Stack.Navigator>
            </NavigationContainer>
          </SyncProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  )
}

export default App
