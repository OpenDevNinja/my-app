// types/index.ts
export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  stock: number;
  sku?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

export interface ProductFilters {
  category?: string;
  minPrice?: string;
  maxPrice?: string;
}

// api/axios.ts
import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://api.votreserveur.com';

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('token');
      // Rediriger vers la page de connexion
      // Note: Implémenter la navigation appropriée
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

// services/authService.ts
import { User, LoginCredentials, RegisterData } from '../types';
import axiosInstance from '../api/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthResponse {
  token: string;
  user: User;
}

interface ErrorResponse {
  status: number;
  message: string;
}

const handleError = (error: any): ErrorResponse => {
  if (error.response) {
    return {
      status: error.response.status,
      message: error.response.data.message || 'Une erreur est survenue'
    };
  }
  if (error.request) {
    return {
      status: 503,
      message: 'Le serveur ne répond pas'
    };
  }
  return {
    status: 500,
    message: 'Erreur lors de la configuration de la requête'
  };
};

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await axiosInstance.post<AuthResponse>('/auth/login', credentials);
      if (response.data.token) {
        await AsyncStorage.setItem('token', response.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await axiosInstance.post<AuthResponse>('/auth/register', userData);
      return response.data;
    } catch (error) {
      throw handleError(error);
    }
  },

  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await axiosInstance.post('/auth/logout');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw handleError(error);
    }
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const userStr = await AsyncStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      return null;
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem('token');
    return !!token;
  }
};

// contexts/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { AuthState, User, LoginCredentials, RegisterData } from '../types';
import { authService } from '../services/authService';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true
  });

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async (): Promise<void> => {
    try {
      const user = await authService.getCurrentUser();
      setState(prev => ({ ...prev, user }));
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'utilisateur:', error);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    const response = await authService.login({ email, password });
    setState(prev => ({ ...prev, user: response.user }));
  };

  const register = async (userData: RegisterData): Promise<void> => {
    await authService.register(userData);
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
      setState(prev => ({ ...prev, user: null }));
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
        value= {{
          ...state,
  login,
  register,
  logout
        }}
      >
  {!state.loading && children}
</AuthContext.Provider>
    );
  };

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

// screens/LoginScreen.tsx
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/types';

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (): Promise<void> => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
    } catch (error: any) {
      Alert.alert(
        'Erreur de connexion',
        error.message || 'Une erreur est survenue lors de la connexion'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style= { styles.container } >
    <TextInput
          style={ styles.input }
  placeholder = "Email"
  value = { email }
  onChangeText = { setEmail }
  keyboardType = "email-address"
  autoCapitalize = "none"
    />
    <TextInput
          style={ styles.input }
  placeholder = "Mot de passe"
  value = { password }
  onChangeText = { setPassword }
  secureTextEntry
    />
    <TouchableOpacity
          style={ styles.button }
  onPress = { handleLogin }
  disabled = { loading }
    >
    <Text style={ styles.buttonText }>
      { loading? 'Connexion en cours...': 'Se connecter' }
      </Text>
      </TouchableOpacity>
      < TouchableOpacity
  onPress = {() => navigation.navigate('Register')}
style = { styles.linkButton }
  >
  <Text style={ styles.linkText }> Pas encore de compte ? S'inscrire</Text>
    </TouchableOpacity>
    </View>
    );
  };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default LoginScreen;


// screens/RegisterScreen.tsx
import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { RegisterData } from '../types';

type RegisterScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

interface RegisterScreenProps {
  navigation: RegisterScreenNavigationProp;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [formData, setFormData] = useState<RegisterData>({
    email: '',
    password: '',
    fullName: '',
    phone: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleChange = (name: keyof RegisterData) => (value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.email || !formData.password || !formData.fullName) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return false;
    }
    if (formData.password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return false;
    }
    return true;
  };

  const handleRegister = async (): Promise<void> => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      await register(formData);
      Alert.alert('Succès', 'Inscription réussie', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Login')
        }
      ]);
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error.message || 'Une erreur est survenue lors de l\'inscription'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style= { styles.container } >
    <Text style={ styles.title }> Inscription </Text>

      < TextInput
  style = { styles.input }
  placeholder = "Nom complet"
  value = { formData.fullName }
  onChangeText = { handleChange('fullName') }
    />

    <TextInput
        style={ styles.input }
  placeholder = "Email"
  value = { formData.email }
  onChangeText = { handleChange('email') }
  keyboardType = "email-address"
  autoCapitalize = "none"
    />

    <TextInput
        style={ styles.input }
  placeholder = "Téléphone"
  value = { formData.phone }
  onChangeText = { handleChange('phone') }
  keyboardType = "phone-pad"
    />

    <TextInput
        style={ styles.input }
  placeholder = "Mot de passe"
  value = { formData.password }
  onChangeText = { handleChange('password') }
  secureTextEntry
    />

    <TextInput
        style={ styles.input }
  placeholder = "Confirmer le mot de passe"
  value = { confirmPassword }
  onChangeText = { setConfirmPassword }
  secureTextEntry
    />

    <TouchableOpacity
        style={ [styles.button, loading && styles.buttonDisabled] }
  onPress = { handleRegister }
  disabled = { loading }
    >
    <Text style={ styles.buttonText }>
      { loading? 'Inscription en cours...': 'S\'inscrire' }
      </Text>
      </TouchableOpacity>

      < TouchableOpacity
  onPress = {() => navigation.navigate('Login')}
style = { styles.linkButton }
  >
  <Text style={ styles.linkText }> Déjà un compte ? Se connecter </Text>
    </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
});

export default RegisterScreen;

// screens/ProductsScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  RefreshControl
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Picker } from '@react-native-picker/picker';
import { Product, ProductFilters, AppStackParamList } from '../types';
import productService from '../services/productService';

type ProductsScreenNavigationProp = NativeStackNavigationProp<AppStackParamList, 'Products'>;

interface ProductsScreenProps {
  navigation: ProductsScreenNavigationProp;
}

const ProductsScreen: React.FC<ProductsScreenProps> = ({ navigation }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<ProductFilters>({
    category: '',
    minPrice: '',
    maxPrice: '',
  });
  const [modalVisible, setModalVisible] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await productService.getProducts(filters);
      setProducts(response.data);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleSearch = async (): Promise<void> => {
    try {
      setLoading(true);
      const results = await productService.searchProducts(searchTerm, filters);
      setProducts(results);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    Alert.alert(
      'Confirmation',
      'Voulez-vous vraiment supprimer ce produit ?',
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await productService.deleteProduct(id);
              setProducts(products.filter(product => product.id !== id));
              Alert.alert('Succès', 'Produit supprimé avec succès');
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
            }
          }
        }
      ]
    );
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  }, [loadProducts]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const renderProduct = ({ item }: { item: Product }) => (
    <View style= { styles.productCard } >
    <Text style={ styles.productName }> { item.name } </Text>
      < Text style = { styles.productPrice } > { item.price } €</Text>
        < Text style = { styles.productCategory } > { item.category } </Text>

          < View style = { styles.actionButtons } >
            <TouchableOpacity
          style={ [styles.button, styles.editButton] }
  onPress = {() => navigation.navigate('ProductForm', { product: item })}
        >
  <Text style={ styles.buttonText }> Modifier </Text>
    </TouchableOpacity>

    < TouchableOpacity
style = { [styles.button, styles.deleteButton]}
onPress = {() => handleDelete(item.id)}
        >
  <Text style={ styles.buttonText }> Supprimer </Text>
    </TouchableOpacity>
    </View>
    </View>
  );

return (
  <View style= { styles.container } >
  <View style={ styles.searchContainer }>
    <TextInput
          style={ styles.searchInput }
placeholder = "Rechercher..."
value = { searchTerm }
onChangeText = { setSearchTerm }
onSubmitEditing = { handleSearch }
  />

  <TouchableOpacity
          style={ styles.filterButton }
onPress = {() => setModalVisible(true)}
        >
  <Text style={ styles.filterButtonText }> Filtres </Text>
    </TouchableOpacity>
    </View>

    < FlatList
data = { products }
renderItem = { renderProduct }
keyExtractor = {(item) => item.id}
refreshControl = {
          < RefreshControl refreshing = { refreshing } onRefresh = { onRefresh } />
        }
contentContainerStyle = { styles.productList }
  />

  <Modal
        animationType="slide"
transparent = { true}
visible = { modalVisible }
onRequestClose = {() => setModalVisible(false)}
      >
  <View style={ styles.modalContainer }>
    <View style={ styles.modalContent }>
      <Text style={ styles.modalTitle }> Filtres </Text>

        < Picker
selectedValue = { filters.category }
onValueChange = {(value) =>
setFilters(prev => ({ ...prev, category: value }))
              }
style = { styles.picker }
  >
  <Picker.Item label="Toutes les catégories" value = "" />
    <Picker.Item label="Électronique" value = "electronics" />
      <Picker.Item label="Vêtements" value = "clothing" />
        <Picker.Item label="Alimentation" value = "food" />
          </Picker>

          < TextInput
style = { styles.input }
placeholder = "Prix minimum"
value = { filters.minPrice }
onChangeText = {(value) =>
setFilters(prev => ({ ...prev, minPrice: value }))
              }
keyboardType = "numeric"
  />

  <TextInput
              style={ styles.input }
placeholder = "Prix maximum"
value = { filters.maxPrice }
onChangeText = {(value) =>
setFilters(prev => ({ ...prev, maxPrice: value }))
              }
keyboardType = "numeric"
  />

  <TouchableOpacity
              style={ styles.applyButton }
onPress = {() => {
  handleSearch();
  setModalVisible(false);
}}
            >
  <Text style={ styles.buttonText }> Appliquer </Text>
    </TouchableOpacity>

    < TouchableOpacity
style = { styles.cancelButton }
onPress = {() => setModalVisible(false)}
            >
  <Text style={ [styles.buttonText, styles.cancelButtonText] }>
    Fermer
    </Text>
    </TouchableOpacity>
    </View>
    </View>
    </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  filterButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  filterButtonText: {
    color: '#fff',
  },
  productList: {
    padding: 10,
  },
  productCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  productPrice: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 5,
  },
  productCategory: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 10,
  },
  editButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  picker: {
    height: 50,
    marginBottom: 15,
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 15,
  },
  applyButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  }




  import React from 'react';
  import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
  import { NavigationContainer } from '@react-navigation/native';
  import HomeScreen from '../screens/HomeScreen';
  import ExploreScreen from '../screens/ExploreScreen';
  import ProfileScreen from '../screens/ProfileScreen';
  import Ionicons from 'react-native-vector-icons/Ionicons';

  type RootTabParamList = {
    Home: undefined;
    Explore: undefined;
    Profile: undefined;
  };

  const Tab = createBottomTabNavigator<RootTabParamList>();

  const BottomTabNavigator = () => {
    return (
      <NavigationContainer>
      <Tab.Navigator
        screenOptions= {({ route }) => ({
  tabBarIcon: ({ color, size }) => {
    let iconName: string;

    if (route.name === 'Home') {
      iconName = 'home-outline';
    } else if (route.name === 'Explore') {
      iconName = 'search-outline';
    } else {
      iconName = 'person-outline';
    }

    return <Ionicons name={ iconName } size = { size } color = { color } />;
  },
  tabBarActiveTintColor: '#FBA83C',
  tabBarInactiveTintColor: 'gray',
  headerShown: false,
})}
      >
  <Tab.Screen name="Home" component = { HomeScreen } />
    <Tab.Screen name="Explore" component = { ExploreScreen } />
      <Tab.Screen name="Profile" component = { ProfileScreen } />
        </Tab.Navigator>
        </NavigationContainer>
  );
};

export default BottomTabNavigator;













import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type RootStackParamList = {
  Home: undefined;
  Explore: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const StackNavigator = () => {
  return (
    <NavigationContainer>
    <Stack.Navigator
        initialRouteName= "Home"
  screenOptions = {{
    headerStyle: { backgroundColor: '#FBA83C' },
    headerTintColor: '#fff',
      headerTitleStyle: { fontWeight: 'bold' },
  }
}
      >
  <Stack.Screen name="Home" component = { HomeScreen } options = {{ title: 'Welcome' }} />
    < Stack.Screen name = "Explore" component = { ExploreScreen } />
      <Stack.Screen name="Profile" component = { ProfileScreen } />
        </Stack.Navigator>
        </NavigationContainer>
  );
};

export default StackNavigator;
import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  Explore: undefined;
  Profile: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <View style= { styles.container } >
    <Text>Home Screen </Text>
      < Button title = "Go to Explore" onPress = {() => navigation.navigate('Explore')} />
        </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
