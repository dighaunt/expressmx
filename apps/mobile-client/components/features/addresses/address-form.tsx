import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import {
  Briefcase,
  CaretDown,
  CaretLeft,
  Check,
  Clock,
  Crosshair,
  House,
  MagnifyingGlass,
  MapPin,
  Star,
} from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, StyleSheet, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetPortal,
  BottomSheetTextInput,
  type BottomSheetRef,
} from '@/components/ui/bottomsheet';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Pressable } from '@/components/ui/pressable';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { BottomBar } from '@/components/ui-app/bottom-bar';
import { FormField } from '@/components/ui-app/form-field';
import { InlineAlert } from '@/components/ui-app/inline-alert';
import { KeyboardAwareForm } from '@/components/ui-app/keyboard-aware-form';
import { PrimaryButton } from '@/components/ui-app/primary-button';
import { ScreenHeader } from '@/components/ui-app/screen-header';
import { api, ApiError } from '@/lib/api/client';
import { mapProvider, type MapCoordinate } from '@/lib/maps';
import { palette } from '@/lib/theme/tokens';

interface AddressItem {
  id: string;
  alias: string | null;
  calle: string;
  numero_ext: string;
  numero_int: string | null;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  referencia: string | null;
  predeterminada: boolean;
  latitud: number | null;
  longitud: number | null;
  zona_id?: string | null;
}

interface AddressesResponse {
  data: AddressItem[];
}

interface SingleAddressResponse {
  data: AddressItem;
}

interface CoverageZone {
  id: string;
  nombre: string;
  centro_lat: string;
  centro_lng: string;
  radio_km: string | null;
  has_polygon: boolean;
}

interface AddressSelection {
  id: string;
  name: string;
  fullAddress: string;
  latitude: number;
  longitude: number;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  postcode: string | null;
  city: string | null;
  state: string | null;
  source: 'autocomplete' | 'map';
}

interface CoverageZonesResponse {
  data: CoverageZone[];
}

type GeocodeFeature = Omit<AddressSelection, 'source'>;

interface GeocodeResponse {
  data: GeocodeFeature[];
}

interface FormState {
  alias: string;
  calle: string;
  numero_ext: string;
  numero_int: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  referencia: string;
  predeterminada: boolean;
  latitud: number | null;
  longitud: number | null;
}

interface Errors {
  zona_id?: string;
  calle?: string;
  numero_ext?: string;
  colonia?: string;
  cp?: string;
  ciudad?: string;
  estado?: string;
  global?: string;
}

interface Props {
  mode: 'create' | 'edit';
  addressId?: string;
  title: string;
  subtitle: string;
  onDone: () => void;
}

const emptyForm: FormState = {
  alias: '',
  calle: '',
  numero_ext: '',
  numero_int: '',
  colonia: '',
  cp: '',
  ciudad: '',
  estado: '',
  referencia: '',
  predeterminada: false,
  latitud: null,
  longitud: null,
};

const searchMinLength = 3;
const searchDelayMs = 260;
const fallbackCenter = { latitude: 19.4326, longitude: -99.1332 };
const styles = StyleSheet.create({
  fullScreenMap: StyleSheet.absoluteFillObject,
});

const labelOptions = [
  { label: 'Casa', icon: House },
  { label: 'Trabajo', icon: Briefcase },
  { label: 'Otro', icon: Star },
];

export function AddressForm({ mode, addressId, title, subtitle, onDone }: Props) {
  if (mode === 'create') {
    return <CreateAddressFlow onDone={onDone} title={title} />;
  }

  return <EditAddressFlow addressId={addressId} title={title} subtitle={subtitle} onDone={onDone} />;
}

function CreateAddressFlow({ title, onDone }: { title: string; onDone: () => void }) {
  const router = useRouter();
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const mapRef = useRef<MapView | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm, alias: 'Casa', predeterminada: true });
  const [zones, setZones] = useState<CoverageZone[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<AddressItem[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeFeature[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [zoneDropdownOpen, setZoneDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<CoverageZonesResponse>('/v1/mobile/coverage/zones'),
      api.get<AddressesResponse>('/v1/mobile/addresses').catch(() => ({ data: [] as AddressItem[] })),
    ])
      .then(([zonesResponse, addressesResponse]) => {
        if (cancelled) return;
        const nextZones = zonesResponse.data ?? [];
        setZones(nextZones);
        setSelectedZoneId(nextZones[0]?.id ?? null);
        setSavedAddresses(addressesResponse.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('No pudimos cargar las zonas disponibles.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => bottomSheetRef.current?.open(0), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const trimmedSearch = search.trim();
    if (!selectedZoneId || trimmedSearch.length < searchMinLength) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .post<GeocodeResponse>('/v1/mobile/google/geocode', {
          query: trimmedSearch,
          zone_id: selectedZoneId,
          autocomplete: true,
          limit: 6,
        })
        .then((response) => {
          if (cancelled) return;
          setSuggestions(response.data ?? []);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) return;
          setSuggestions([]);
          setError(err instanceof ApiError ? err.message : 'No pudimos buscar esa dirección.');
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, searchDelayMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, selectedZoneId]);

  const selectedZone = zones.find((zone) => zone.id === selectedZoneId) ?? null;
  const zoneCenter = getZoneCenter(selectedZone);
  const activeCoordinate = getCoordinate(form.latitud, form.longitud) ?? zoneCenter ?? fallbackCenter;
  const activeLatitude = activeCoordinate.latitude;
  const activeLongitude = activeCoordinate.longitude;

  useEffect(() => {
    mapRef.current?.animateToRegion(
      {
        latitude: activeLatitude,
        longitude: activeLongitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      250,
    );
  }, [activeLatitude, activeLongitude]);

  const filteredSaved = useMemo(() => {
    const query = normalize(search);
    return savedAddresses
      .filter((item) => getCoordinate(item.latitud, item.longitud))
      .filter((item) => {
        if (!query) return true;
        return normalize(formatSavedAddress(item)).includes(query);
      })
      .slice(0, 4);
  }, [savedAddresses, search]);

  function updateFormFromSelection(selection: AddressSelection) {
    const next = formFromSelection(selection, selectedZone);
    setForm((prev) => ({
      ...prev,
      ...next,
      alias: prev.alias || 'Casa',
    }));
    setSelectedAddress(selection.fullAddress || selection.name);
    setSearch(selection.fullAddress || selection.name);
    setSuggestions([]);
    setSearchFocused(false);
    setError(null);
    Keyboard.dismiss();
  }

  function selectSuggestion(feature: GeocodeFeature) {
    updateFormFromSelection({ ...feature, source: 'autocomplete' });
  }

  function selectSavedAddress(item: AddressItem) {
    const coordinate = getCoordinate(item.latitud, item.longitud);
    if (!coordinate) return;
    setForm({
      alias: item.alias ?? 'Casa',
      calle: item.calle,
      numero_ext: item.numero_ext,
      numero_int: item.numero_int ?? '',
      colonia: item.colonia,
      cp: item.cp,
      ciudad: item.ciudad,
      estado: item.estado,
      referencia: item.referencia ?? '',
      predeterminada: true,
      latitud: coordinate.latitude,
      longitud: coordinate.longitude,
    });
    if (item.zona_id) setSelectedZoneId(item.zona_id);
    const address = formatSavedAddress(item);
    setSelectedAddress(address);
    setSearch(address);
    setSuggestions([]);
    setSearchFocused(false);
    setError(null);
    Keyboard.dismiss();
  }

  function selectZone(zoneId: string) {
    setSelectedZoneId(zoneId);
    setZoneDropdownOpen(false);
    setSuggestions([]);
    setError(null);
  }

  function toggleZoneDropdown() {
    setZoneDropdownOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        setSearchFocused(false);
        Keyboard.dismiss();
      }
      return nextOpen;
    });
  }

  async function selectCoordinate(coordinate: MapCoordinate) {
    if (!selectedZoneId) return;
    setResolving(true);
    setError(null);
    setForm((prev) => ({
      ...prev,
      latitud: coordinate.latitude,
      longitud: coordinate.longitude,
    }));

    try {
      const response = await api.post<GeocodeResponse>('/v1/mobile/google/reverse-geocode', {
        zone_id: selectedZoneId,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
      const feature = response.data[0];
      if (feature) updateFormFromSelection({ ...feature, source: 'map' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos resolver ese punto.');
    } finally {
      setResolving(false);
    }
  }

  async function useCurrentLocation() {
    setLocating(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setError('Activa la ubicación para colocar el pin en tu dirección actual.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await selectCoordinate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setError('No pudimos obtener tu ubicación actual.');
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    if (!selectedZoneId) {
      setError('Elige una zona disponible.');
      return;
    }
    if (!form.latitud || !form.longitud || !selectedAddress) {
      setError('Selecciona una dirección en el mapa.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post<SingleAddressResponse>('/v1/mobile/addresses', {
        alias: form.alias.trim() || null,
        calle: form.calle.trim(),
        numero_ext: form.numero_ext.trim(),
        numero_int: form.numero_int.trim() || null,
        colonia: form.colonia.trim(),
        cp: form.cp.trim(),
        ciudad: form.ciudad.trim(),
        estado: form.estado.trim(),
        referencia: form.referencia.trim() || null,
        predeterminada: form.predeterminada,
        latitud: form.latitud,
        longitud: form.longitud,
        zona_id: selectedZoneId,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos guardar tu dirección.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleMapPress(event: MapPressEvent) {
    void selectCoordinate(event.nativeEvent.coordinate);
  }

  const showDropdown = searchFocused && (filteredSaved.length > 0 || suggestions.length > 0 || searching);
  const busy = locating || resolving;

  return (
    <Box className="flex-1 bg-background">
      <MapView
        ref={mapRef}
        style={styles.fullScreenMap}
        onPress={handleMapPress}
        initialRegion={{ ...activeCoordinate, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        provider={mapProvider}
      >
        <Marker
          coordinate={activeCoordinate}
          draggable
          onDragEnd={(event) => void selectCoordinate(event.nativeEvent.coordinate)}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: palette.brand,
              borderWidth: 3,
              borderColor: palette.surface,
            }}
          >
            <MapPin size={24} color={palette.surface} weight="fill" />
          </View>
        </Marker>
      </MapView>

      <Box className="absolute left-0 right-0 top-0 px-5 pt-4" style={{ zIndex: 20, elevation: 20 }}>
        <HStack className="items-center gap-3">
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/addresses'))}
            className="w-11 h-11 rounded-xl bg-background items-center justify-center border border-border"
            hitSlop={10}
          >
            <CaretLeft size={22} color={palette.textPrimary} weight="bold" />
          </Pressable>
          <VStack className="flex-1">
            <Text className="text-lg font-bold text-foreground">{title}</Text>
            <Text className="text-xs text-foreground-secondary">Busca, toca el mapa o usa tu ubicación.</Text>
          </VStack>
          <Pressable
            onPress={useCurrentLocation}
            disabled={locating}
            className="w-11 h-11 rounded-xl bg-background items-center justify-center border border-border"
            hitSlop={10}
          >
            {locating ? (
              <Spinner size="small" color={palette.brand} />
            ) : (
              <Crosshair size={22} color={palette.brand} weight="bold" />
            )}
          </Pressable>
        </HStack>

        <VStack
          className="mt-3 rounded-2xl border border-border bg-background overflow-hidden"
          style={{ zIndex: 30, elevation: 30 }}
        >
          <HStack className="h-13 items-center gap-2 px-3">
            <MagnifyingGlass size={18} color={palette.textTertiary} weight="bold" />
            <Input className="flex-1 h-11 border-0 shadow-none bg-transparent px-0">
              <InputField
                value={search}
                onChangeText={setSearch}
                onFocus={() => {
                  setSearchFocused(true);
                  setZoneDropdownOpen(false);
                }}
                placeholder="¿Dónde quieres recibir el servicio?"
                placeholderTextColor={palette.textTertiary}
                autoCapitalize="words"
                returnKeyType="search"
                style={{ letterSpacing: 0 }}
              />
            </Input>
            {searching ? <Spinner size="small" color={palette.brand} /> : null}
          </HStack>

          {showDropdown ? (
            <VStack className="border-t border-border">
              {filteredSaved.map((item) => (
                <AddressSuggestionRow
                  key={item.id}
                  icon="saved"
                  title={item.alias ?? `${item.calle} ${item.numero_ext}`}
                  subtitle={formatSavedAddress(item)}
                  onPress={() => selectSavedAddress(item)}
                />
              ))}
              {suggestions.map((item) => (
                <AddressSuggestionRow
                  key={item.id}
                  icon="search"
                  title={item.name}
                  subtitle={item.fullAddress}
                  onPress={() => selectSuggestion(item)}
                />
              ))}
            </VStack>
          ) : null}
        </VStack>
      </Box>

      <BottomSheet ref={bottomSheetRef} defaultSnapIndex={0}>
        <BottomSheetPortal
          snapPoints={['38%', '72%']}
          enablePanDownToClose={false}
          enableDynamicSizing={false}
          backgroundClassName="rounded-t-3xl"
          handleIndicatorClassName="bg-border"
        >
          <BottomSheetContent className="px-5 gap-3">
            {error ? <InlineAlert tone="warning" message={error} /> : null}

            <HStack className="items-start gap-3">
              <Box className="w-10 h-10 rounded-xl bg-primary-soft items-center justify-center">
                {busy ? <Spinner size="small" color={palette.brand} /> : <MapPin size={20} color={palette.brand} weight="fill" />}
              </Box>
              <VStack className="flex-1 gap-1">
                <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                  {selectedAddress ? form.alias || 'Dirección seleccionada' : 'Selecciona tu dirección'}
                </Text>
                <Text className="text-xs text-foreground-secondary" numberOfLines={2}>
                  {selectedAddress || 'Mueve el pin al punto exacto para que el prestador llegue sin fricción.'}
                </Text>
              </VStack>
            </HStack>

            {zones.length > 1 ? (
              <VStack className="gap-2">
                <Pressable onPress={toggleZoneDropdown} accessibilityRole="button">
                  <HStack className="h-13 rounded-xl border border-border bg-muted px-3 items-center gap-3">
                    <Box className="w-8 h-8 rounded-lg bg-background items-center justify-center">
                      <MapPin size={16} color={palette.brand} weight="fill" />
                    </Box>
                    <VStack className="flex-1 gap-0.5">
                      <Text className="text-[11px] font-semibold uppercase text-foreground-secondary">Ubicación</Text>
                      <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                        Elegir zona de cobertura
                      </Text>
                    </VStack>
                    <CaretDown size={18} color={palette.textSecondary} weight="bold" />
                  </HStack>
                </Pressable>

                {zoneDropdownOpen ? (
                  <VStack className="overflow-hidden rounded-xl border border-border bg-background">
                    {zones.map((zone) => {
                      const selected = selectedZoneId === zone.id;
                      return (
                        <Pressable key={zone.id} onPress={() => selectZone(zone.id)} accessibilityRole="button">
                          <HStack className="min-h-12 items-center gap-3 border-b border-border px-3 py-3">
                            <VStack className="flex-1">
                              <Text
                                className={`text-sm font-bold ${selected ? 'text-primary' : 'text-foreground'}`}
                                numberOfLines={1}
                              >
                                {zone.nombre}
                              </Text>
                            </VStack>
                            {selected ? <Check size={18} color={palette.brand} weight="bold" /> : null}
                          </HStack>
                        </Pressable>
                      );
                    })}
                  </VStack>
                ) : null}
              </VStack>
            ) : null}

            <HStack className="gap-2">
              {labelOptions.map(({ label, icon: Icon }) => {
                const selected = form.alias === label;
                return (
                  <Pressable key={label} className="flex-1" onPress={() => setForm((prev) => ({ ...prev, alias: label }))}>
                    <HStack
                      className={`h-11 rounded-xl border items-center justify-center gap-2 ${
                        selected ? 'border-primary bg-primary-soft' : 'border-border bg-muted'
                      }`}
                    >
                      <Icon size={16} color={selected ? palette.brand : palette.textSecondary} weight={selected ? 'fill' : 'regular'} />
                      <Text className={`text-xs font-bold ${selected ? 'text-primary' : 'text-foreground'}`}>{label}</Text>
                    </HStack>
                  </Pressable>
                );
              })}
            </HStack>

            <BottomSheetTextInput
              value={form.alias}
              onChangeText={(value) => setForm((prev) => ({ ...prev, alias: value }))}
              placeholder="Etiqueta: Casa, Oficina, Mamá..."
              placeholderTextColor={palette.textTertiary}
              autoCapitalize="words"
              maxLength={30}
              style={{ letterSpacing: 0 }}
            />

            <HStack className="bg-muted rounded-xl p-3 items-center gap-3">
              <VStack className="flex-1">
                <Text className="text-sm font-semibold text-foreground">Usar como predeterminada</Text>
                <Text className="text-xs text-foreground-secondary">Aparecerá primero al pedir un servicio.</Text>
              </VStack>
              <Switch
                value={form.predeterminada}
                onValueChange={(value) => setForm((prev) => ({ ...prev, predeterminada: value }))}
                trackColor={{ true: palette.brand, false: palette.borderStrong }}
                thumbColor={palette.surface}
              />
            </HStack>

            <PrimaryButton onPress={handleSubmit} loading={submitting}>
              {submitting ? 'Guardando...' : 'Guardar dirección'}
            </PrimaryButton>
          </BottomSheetContent>
        </BottomSheetPortal>
      </BottomSheet>
    </Box>
  );
}

function EditAddressFlow({
  addressId,
  title,
  subtitle,
  onDone,
}: {
  addressId?: string;
  title: string;
  subtitle: string;
  onDone: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!addressId) return;
    let cancelled = false;
    api
      .get<AddressesResponse>('/v1/mobile/addresses')
      .then((response) => {
        if (cancelled) return;
        const found = response.data.find((item) => item.id === addressId);
        if (!found) return;
        setForm({
          alias: found.alias ?? '',
          calle: found.calle ?? '',
          numero_ext: found.numero_ext ?? '',
          numero_int: found.numero_int ?? '',
          colonia: found.colonia ?? '',
          cp: found.cp ?? '',
          ciudad: found.ciudad ?? '',
          estado: found.estado ?? '',
          referencia: found.referencia ?? '',
          predeterminada: found.predeterminada,
          latitud: found.latitud,
          longitud: found.longitud,
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [addressId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit() {
    if (!addressId) return;
    setSubmitting(true);
    try {
      await api.patch<SingleAddressResponse>(`/v1/mobile/addresses/${addressId}`, {
        alias: form.alias.trim() || null,
        referencia: form.referencia.trim() || null,
        predeterminada: form.predeterminada,
      });
      onDone();
    } catch (err) {
      setErrors({ global: err instanceof ApiError ? err.message : 'No pudimos guardar tu dirección.' });
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete() {
    if (!addressId) return;
    Alert.alert('Eliminar dirección', 'No podrás recuperarla. ¿Continuamos?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setRemoving(true);
          try {
            await api.delete(`/v1/mobile/addresses/${addressId}`);
            onDone();
          } catch (err) {
            setErrors({ global: err instanceof ApiError ? err.message : 'No pudimos eliminar la dirección.' });
          } finally {
            setRemoving(false);
          }
        },
      },
    ]);
  }

  return (
    <Box className="flex-1 bg-background">
      <ScreenHeader title={title} subtitle={subtitle} />
      <KeyboardAwareForm
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        footer={
          <BottomBar>
            <PrimaryButton onPress={handleSubmit} loading={submitting}>
              {submitting ? 'Guardando...' : 'Guardar cambios'}
            </PrimaryButton>
          </BottomBar>
        }
      >
        <VStack className="gap-4">
          {errors.global ? <InlineAlert tone="danger" message={errors.global} /> : null}

          <FormField
            label="Etiqueta"
            value={form.alias}
            onChangeText={(value) => update('alias', value)}
            placeholder="Casa, oficina, casa de mamá..."
            autoCapitalize="words"
            maxLength={30}
          />

          <VStack className="bg-muted rounded-xl p-4 gap-1">
            <Text className="text-sm font-bold text-foreground">
              {form.calle} {form.numero_ext}
            </Text>
            <Text className="text-xs text-foreground-secondary">
              {form.colonia}, {form.ciudad}, {form.estado} · CP {form.cp}
            </Text>
          </VStack>

          <FormField
            label="Referencia (opcional)"
            value={form.referencia}
            onChangeText={(value) => update('referencia', value)}
            placeholder="Frente al parque, portón blanco."
            multiline
            numberOfLines={3}
            maxLength={200}
          />

          <HStack className="bg-muted rounded-xl p-4 items-center gap-3">
            <VStack className="flex-1">
              <Text className="text-sm font-semibold text-foreground">Usar como predeterminada</Text>
              <Text className="text-xs text-foreground-secondary">La dirección que aparece primero al pedir un servicio.</Text>
            </VStack>
            <Switch
              value={form.predeterminada}
              onValueChange={(value) => update('predeterminada', value)}
              trackColor={{ true: palette.brand, false: palette.borderStrong }}
              thumbColor={palette.surface}
            />
          </HStack>

          <Pressable onPress={confirmDelete} disabled={removing}>
            <Box className="px-4 py-3.5 rounded-xl border border-destructive-soft items-center">
              <Text className="text-sm font-semibold text-destructive">
                {removing ? 'Eliminando...' : 'Eliminar dirección'}
              </Text>
            </Box>
          </Pressable>
        </VStack>
      </KeyboardAwareForm>
    </Box>
  );
}

function AddressSuggestionRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: 'saved' | 'search';
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <HStack className="gap-3 px-3 py-3 border-b border-border items-start">
        <Box className="w-8 h-8 rounded-lg bg-muted items-center justify-center">
          {icon === 'saved' ? (
            <Clock size={16} color={palette.textSecondary} weight="bold" />
          ) : (
            <MagnifyingGlass size={16} color={palette.brand} weight="bold" />
          )}
        </Box>
        <VStack className="flex-1 gap-0.5">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-xs text-foreground-secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
}

function formFromSelection(selection: AddressSelection, zone: CoverageZone | null): Partial<FormState> {
  const fallbackStreet = firstAddressPart(selection.fullAddress) || selection.name || 'Dirección seleccionada';
  const city = selection.city || zone?.nombre || 'Ciudad de México';
  return {
    calle: selection.street || fallbackStreet,
    numero_ext: selection.number || 'S/N',
    numero_int: '',
    colonia: selection.neighborhood || city,
    cp: selection.postcode || '00000',
    ciudad: city,
    estado: selection.state || 'México',
    latitud: selection.latitude,
    longitud: selection.longitude,
  };
}

function firstAddressPart(value: string): string {
  return value.split(',')[0]?.trim() ?? '';
}

function getCoordinate(latitude?: number | null, longitude?: number | null): MapCoordinate | null {
  return typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
}

function getZoneCenter(zone: CoverageZone | null): MapCoordinate | null {
  if (!zone) return null;
  const latitude = Number(zone.centro_lat);
  const longitude = Number(zone.centro_lng);
  return getCoordinate(latitude, longitude);
}

function formatSavedAddress(item: AddressItem): string {
  return [
    `${item.calle} ${item.numero_ext}`,
    item.colonia,
    item.ciudad,
    item.estado,
    item.cp,
  ]
    .filter(Boolean)
    .join(', ');
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
