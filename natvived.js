
npm install axios @react-native-async-storage/async-storage
// api/axios.js
import axios from 'axios';

const API_URL = 'https://api.votreserveur.com';

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour ajouter le token à chaque requête
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs globalement
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expiré ou invalide
      localStorage.removeItem('token');
      // Rediriger vers la page de connexion
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
// services/authService.js
import axiosInstance from '../api/axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const handleError = (error) => {
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

const login = async (email, password) => {
  try {
    const response = await axiosInstance.post('/auth/login', {
      email,
      password
    });
    
    if (response.data.token) {
      await AsyncStorage.setItem('token', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

const register = async (userData) => {
  try {
    const response = await axiosInstance.post('/auth/register', userData);
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

const logout = async () => {
  try {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    // Optionnel: Appeler l'API pour invalider le token
    await axiosInstance.post('/auth/logout');
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    throw handleError(error);
  }
};

const getCurrentUser = async () => {
  try {
    const user = await AsyncStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return null;
  }
};

const refreshToken = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    const response = await axiosInstance.post('/auth/refresh-token', {
      refreshToken
    });
    
    if (response.data.token) {
      await AsyncStorage.setItem('token', response.data.token);
    }
    
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

// Fonction utilitaire pour vérifier si l'utilisateur est authentifié
const isAuthenticated = async () => {
  const token = await AsyncStorage.getItem('token');
  return !!token;
};

// Fonction pour mettre à jour les informations de l'utilisateur
const updateUserProfile = async (userData) => {
  try {
    const response = await axiosInstance.put('/auth/profile', userData);
    await AsyncStorage.setItem('user', JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

// Fonction pour réinitialiser le mot de passe
const resetPassword = async (email) => {
  try {
    const response = await axiosInstance.post('/auth/reset-password', { email });
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

export const authService = {
  login,
  register,
  logout,
  getCurrentUser,
  refreshToken,
  isAuthenticated,
  updateUserProfile,
  resetPassword
};

export default authService;




// contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import AuthService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const user = await AuthService.getCurrentUser();
      setUser(user);
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'utilisateur:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await AuthService.login(email, password);
      setUser(response.user);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await AuthService.register(userData);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AuthService.logout();
      setUser(null);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};








// screens/LoginScreen.js
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      // La navigation sera gérée automatiquement par le navigateur d'authentification
    } catch (error) {
      Alert.alert(
        'Erreur de connexion',
        error.message || 'Une erreur est survenue lors de la connexion'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Connexion en cours...' : 'Se connecter'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate('Register')}
        style={styles.linkButton}
      >
        <Text style={styles.linkText}>Pas encore de compte ? S'inscrire</Text>
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


import { AuthProvider } from './contexts/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      {/* Votre navigation et autres composants */}
    </AuthProvider>
  );
}


// screens/RegisterScreen.js
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
import authService from '../services/authService';

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.fullName) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const response = await authService.register({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone
      });

      Alert.alert('Succès', 'Inscription réussie', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Login')
        }
      ]);
    } catch (error) {
      Alert.alert(
        'Erreur',
        error.message || 'Une erreur est survenue lors de l\'inscription'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Inscription</Text>

      <TextInput
        style={styles.input}
        placeholder="Nom complet"
        value={formData.fullName}
        onChangeText={(value) => handleChange('fullName', value)}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={formData.email}
        onChangeText={(value) => handleChange('email', value)}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Téléphone"
        value={formData.phone}
        onChangeText={(value) => handleChange('phone', value)}
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        value={formData.password}
        onChangeText={(value) => handleChange('password', value)}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirmer le mot de passe"
        value={formData.confirmPassword}
        onChangeText={(value) => handleChange('confirmPassword', value)}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Inscription en cours...' : 'S\'inscrire'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
        style={styles.linkButton}
      >
        <Text style={styles.linkText}>Déjà un compte ? Se connecter</Text>
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
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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





// services/productService.js
import axiosInstance from '../api/axios';

const createProduct = async (productData) => {
  try {
    const response = await axiosInstance.post('/products', productData);
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

const getProducts = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/products', { params });
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

const updateProduct = async (id, productData) => {
  try {
    const response = await axiosInstance.put(`/products/${id}`, productData);
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

const deleteProduct = async (id) => {
  try {
    await axiosInstance.delete(`/products/${id}`);
    return true;
  } catch (error) {
    throw handleError(error);
  }
};

const searchProducts = async (searchTerm, filters = {}) => {
  try {
    const params = {
      search: searchTerm,
      ...filters
    };
    const response = await axiosInstance.get('/products/search', { params });
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

const handleError = (error) => {
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

export const productService = {
  createProduct,
  getProducts,
  updateProduct,
  deleteProduct,
  searchProducts
};

export default productService;




// screens/ProductsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal
} from 'react-native';
import productService from '../services/productService';
import { Picker } from '@react-native-picker/picker';

const ProductsScreen = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    minPrice: '',
    maxPrice: '',
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await productService.getProducts();
      setProducts(data);
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const data = await productService.searchProducts(searchTerm, filters);
      setProducts(data);
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
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
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          }
        }
      ]
    );
  };

  const renderProduct = ({ item }) => (
    <View style={styles.productCard}>
      <Text style={styles.productName}>{item.name}</Text>
      <Text style={styles.productPrice}>{item.price} €</Text>
      <Text style={styles.productCategory}>{item.category}</Text>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.button, styles.editButton]}
          onPress={() => {
            setCurrentProduct(item);
            setModalVisible(true);
          }}
        >
          <Text style={styles.buttonText}>Modifier</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={styles.buttonText}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  useEffect(() => {
    loadProducts();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          onSubmitEditing={handleSearch}
        />
        
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.filterButtonText}>Filtres</Text>
        </TouchableOpacity>
      </View>

      {/* Liste des produits */}
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.productList}
      />

      {/* Modal des filtres */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filtres</Text>

            <Picker
              selectedValue={filters.category}
              onValueChange={(value) => 
                setFilters(prev => ({ ...prev, category: value }))
              }
              style={styles.picker}
            >
              <Picker.Item label="Toutes les catégories" value="" />
              <Picker.Item label="Électronique" value="electronics" />
              <Picker.Item label="Vêtements" value="clothing" />
              <Picker.Item label="Alimentation" value="food" />
            </Picker>

            <TextInput
              style={styles.input}
              placeholder="Prix minimum"
              value={filters.minPrice}
              onChangeText={(value) => 
                setFilters(prev => ({ ...prev, minPrice: value }))
              }
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="Prix maximum"
              value={filters.maxPrice}
              onChangeText={(value) => 
                setFilters(prev => ({ ...prev, maxPrice: value }))
              }
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => {
                handleSearch();
                setModalVisible(false);
              }}
            >
              <Text style={styles.buttonText}>Appliquer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
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
    elevation: 5,
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
  },
  cancelButtonText: {
    color: '#007AFF',
  }
});



// screens/ProductFormScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import productService from '../services/productService';

const ProductFormScreen = ({ route, navigation }) => {
  const editingProduct = route.params?.product;
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    stock: '',
    sku: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name,
        description: editingProduct.description,
        price: editingProduct.price.toString(),
        category: editingProduct.category,
        stock: editingProduct.stock.toString(),
        sku: editingProduct.sku
      });
    }
  }, [editingProduct]);

  const handleChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.name || !formData.price || !formData.category) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return false;
    }
    if (isNaN(formData.price) || parseFloat(formData.price) <= 0) {
      Alert.alert('Erreur', 'Le prix doit être un nombre positif');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock) || 0
      };

      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, productData);
        Alert.alert('Succès', 'Produit modifié avec succès');
      } else {
        await productService.createProduct(productData);
        Alert.alert('Succès', 'Produit créé avec succès');
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Erreur',
        error.message || 'Une erreur est survenue lors de la sauvegarde'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Nom du produit *"
        value={formData.name}
        onChangeText={(value) => handleChange('name', value)}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description"
        value={formData.description}
        onChangeText={(value) => handleChange('description', value)}
        multiline
        numberOfLines={4}
      />

      <TextInput
        style={styles.input}
        placeholder="Prix *"
        value={formData.price}
        onChangeText={(value) => handleChange('price', value)}
        keyboardType="decimal-pad"
      />

      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={formData.category}
          onValueChange={(value) => handleChange('category', value)}
          style={styles.picker}
        >
          <Picker.Item label="Sélectionner une catégorie *" value="" />
          <Picker.Item label="Électronique" value="electronics" />
          <Picker.Item label="Vêtements" value="clothing" />
          <Picker.Item label="Alimentation" value="food" />
        </Picker>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Stock"
        value={formData.stock}
        onChangeText={(value) => handleChange('stock', value)}
        keyboardType="numeric"
      />

      <TextInput
        style={styles.input}
        placeholder="SKU"
        value={formData.sku}
        onChangeText={(value) => handleChange('sku', value)}
      />

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? 'Sauvegarde en cours...' : 'Sauvegarder'}
        </Text>
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
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 15,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  picker: {
    height: 50,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProductFormScreen;




// navigation/AppNavigator.js
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Products" 
        component={ProductsScreen}
        options={({ navigation }) => ({
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => navigation.navigate('ProductForm')}
              style={{ marginRight: 15 }}
            >
              <Text>Nouveau</Text>
            </TouchableOpacity>
          )
        })}
      />
      <Stack.Screen 
        name="ProductForm" 
        component={ProductFormScreen}
        options={({ route }) => ({
          title: route.params?.product ? 'Modifier' : 'Nouveau produit'
        })}
      />
    </Stack.Navigator>
  );
}