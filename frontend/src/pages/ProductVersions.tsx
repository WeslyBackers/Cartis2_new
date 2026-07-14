import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { format } from 'date-fns';
import { useAuthStore } from '../stores/authStore';
import { openCorrectionListPrintPreview } from '../utils/printUtils';
import { getApiErrorMessage } from '../utils/errorUtils';
import { ProductVersionMapOverview } from '../components/ProductVersionMapOverview';

const getTaskStatusLabel = (status: string) => {
  if (status === 'hoog_te_verwerken') return 'Hoog te verwerken';
  if (status === 'te_verwerken') return 'Te verwerken';
  if (status === 'in_inspectie') return 'In Inspectie';
  if (status === 'voltooid') return 'Voltooid';
  if (status === 'niet_van_toepassing') return 'Niet van toepassing';
  return status || '-';
};

const sanitizeHtmlForDisplay = (html: string): string => {
  if (!html) return '';

  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '');
};

// Used for generated publication HTML previews where CSS (tables/lists) must remain intact.
const sanitizePublicationHtmlForDisplay = (html: string): string => {
  if (!html) return '';

  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<(iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '');
};

const cleanProductDescription = (description: string): string => {
  if (!description) return '';

  return description
    .replace(/^\s*attribute\s*value\s*objnam\s*[:=-]?\s*/i, '')
    .trim();
};

const includesText = (haystack: string | null | undefined, needle: string): boolean =>
  String(haystack || '').toLowerCase().includes(String(needle || '').toLowerCase());

const normalizeValue = (value: string | null | undefined): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const isCorrectionListProduct = (productCode: string | null | undefined, productName: string | null | undefined): boolean => {
  const rawCode = String(productCode || '').trim();
  const normalizedCode = normalizeValue(productCode);
  const normalizedName = normalizeValue(productName);

  return rawCode.startsWith('VL-') || normalizedCode.includes('verbeterlijst') || normalizedName.includes('verbeterlijst');
};

const INTEGRATED_CORRECTION_LIST_CODES = new Set([
  'VL-BG',
  'VL-BL',
  'VL-BNZ',
  'VL-D11',
  'VL-NP',
  'VL-OS',
  'VL-ZB_AH',
  'VL-ZB_VH',
  'VL-ZB-VH',
]);

const isIntegratedCorrectionListCode = (code: string | null | undefined): boolean => {
  const normalized = String(code || '').trim().toUpperCase().replace(/[_-]/g, '');

  for (const candidate of INTEGRATED_CORRECTION_LIST_CODES) {
    if (candidate.replace(/[_-]/g, '') === normalized) {
      return true;
    }
  }

  return false;
};

const parseVersionDateValue = (value: any): Date | null => {
  if (!value) return null;

  const raw = String(value).trim();
  const exactIsoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (exactIsoDate) {
    const [, year, month, day] = exactIsoDate;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const normalizeVersionDateForFilter = (value: any): string => {
  const parsed = parseVersionDateValue(value);
  if (!parsed) return '';
  return format(parsed, 'dd-MM-yyyy');
};
const getProductVersionStatusLabel = (status: string | null | undefined): string => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'gepubliceerd' || normalized === 'published') return 'Gepubliceerd';
  if (normalized === 'in inspectie' || normalized === 'in_inspectie') return 'In inspectie';
  return 'In behandeling';
};

const isProductVersionPublished = (status: string | null | undefined): boolean => {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'gepubliceerd' || normalized === 'published';
};

const normalizeProductVersionStatus = (status: string | null | undefined): 'in behandeling' | 'in inspectie' | 'gepubliceerd' => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'gepubliceerd' || normalized === 'published') return 'gepubliceerd';
  if (normalized === 'in inspectie' || normalized === 'in_inspectie') return 'in inspectie';
  return 'in behandeling';
};

export default function ProductVersions() {
  const MIN_PRODUCTS_LIST_HEIGHT = 220;
  const MIN_DETAILS_SECTION_HEIGHT = 260;
  const SPLITTER_HEIGHT = 14;
  const [searchParams] = useSearchParams();
  const [isCreateVersionCollapsed, setIsCreateVersionCollapsed] = useState(true);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [productsListHeight, setProductsListHeight] = useState(320);
  const [isResizingSections, setIsResizingSections] = useState(false);
  const [newEditionOnPublish, setNewEditionOnPublish] = useState(false);
  const [publishDateOnPublish, setPublishDateOnPublish] = useState('');
  const [selectedProductIdForCreate, setSelectedProductIdForCreate] = useState<number | null>(null);
  const [editionNumber, setEditionNumber] = useState('01');
  const [updateNumber, setUpdateNumber] = useState('00');
  const [createVersionStatus, setCreateVersionStatus] = useState<'in behandeling' | 'in inspectie'>('in behandeling');
  const [versionDate, setVersionDate] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [previewArticle, setPreviewArticle] = useState<any | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [correctionListLanguage, setCorrectionListLanguage] = useState<'nl' | 'en'>('nl');
  const [baz2PublicationLanguage, setBaz2PublicationLanguage] = useState<'nl' | 'en'>('nl');
  const [colFilterProductCode, setColFilterProductCode] = useState('');
  const [colFilterProductDescription, setColFilterProductDescription] = useState('');
  const [colFilterVersionNumber, setColFilterVersionNumber] = useState('');
  const [colFilterVersionDatePicker, setColFilterVersionDatePicker] = useState('');
  const [colFilterVersionDate, setColFilterVersionDate] = useState('');
  const [colFilterStatus, setColFilterStatus] = useState('');
  const [colFilterCreatedBy, setColFilterCreatedBy] = useState('');
  const [colFilterNotes, setColFilterNotes] = useState('');
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isMapCollapsed, setIsMapCollapsed] = useState(true);
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const currentProductionLineId = useAuthStore((state) => state.currentProductionLineId);
  const user = useAuthStore((state) => state.user);
  const activeLineName = user?.rights?.find((r) => Number(r.id) === Number(currentProductionLineId))?.name;
  const defaultLineName = user?.defaultProductionLineName ?? null;
  const isDefaultLine = Number(currentProductionLineId) === Number(user?.defaultProductionLineId);
  const queryClient = useQueryClient();

  // Set document title
  useEffect(() => {
    const lineNames: Record<number, string> = { 1: 'Zeekaart', 2: 'Inland ENC', 3: 'Pilot ENC', 4: 'Publicaties' };
    const lineName = currentProductionLineId ? lineNames[currentProductionLineId] : null;
    document.title = lineName ? `Productversies - ${lineName} - CARTIS` : 'Productversies - CARTIS';
    return () => { document.title = 'CARTIS 2.0'; };
  }, [currentProductionLineId]);

  useEffect(() => {
    setSelectedVersionId(null);
  }, [currentProductionLineId]);

  useEffect(() => {
    const versionIdParam = searchParams.get('versionId');
    if (!versionIdParam) return;

    const parsedVersionId = Number(versionIdParam);
    if (!Number.isNaN(parsedVersionId) && parsedVersionId > 0) {
      setSelectedVersionId(parsedVersionId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!isResizingSections) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStartRef.current) {
        return;
      }

      const totalResizableHeight = Math.max(560, Math.round(window.innerHeight * 0.75));
      const maxProductsListHeight = Math.max(
        MIN_PRODUCTS_LIST_HEIGHT,
        totalResizableHeight - MIN_DETAILS_SECTION_HEIGHT - SPLITTER_HEIGHT
      );
      const nextHeight = resizeStartRef.current.startHeight + (event.clientY - resizeStartRef.current.startY);

      setProductsListHeight(Math.min(maxProductsListHeight, Math.max(MIN_PRODUCTS_LIST_HEIGHT, nextHeight)));
    };

    const handleMouseUp = () => {
      setIsResizingSections(false);
      resizeStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSections]);

  // Handle Escape key to close expanded map
  useEffect(() => {
    if (!isMapExpanded) return;

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMapExpanded(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isMapExpanded]);

  const { data: productionLines } = useQuery({
    queryKey: ['productionLinesForProductVersions'],
    queryFn: async () => {
      const response = await api.get('/production-lines');
      return response.data;
    },
  });

  const { data: versions, isLoading } = useQuery({
    queryKey: ['productVersionsOpen', currentProductionLineId],
    queryFn: async () => {
      const response = await api.get('/product-versions', {
        params: { productionLineId: currentProductionLineId || undefined },
      });
      return response.data;
    },
    enabled: !!currentProductionLineId,
  });

  const { data: products } = useQuery({
    queryKey: ['productsForVersionCreate', currentProductionLineId],
    queryFn: async () => {
      const response = await api.get('/products', {
        params: { productionLineId: currentProductionLineId || undefined },
      });
      return response.data;
    },
    enabled: !!currentProductionLineId,
  });

  const { data: selectedVersion, isLoading: isLoadingSelectedVersion } = useQuery({
    queryKey: ['productVersionDetail', selectedVersionId],
    queryFn: async () => {
      const response = await api.get(`/product-versions/${selectedVersionId}`);
      return response.data;
    },
    enabled: !!selectedVersionId,
  });

  const { data: versionAttachments, isLoading: isLoadingVersionAttachments } = useQuery({
    queryKey: ['productVersionAttachments', selectedVersionId],
    queryFn: async () => {
      const response = await api.get(`/product-versions/${selectedVersionId}/attachments`);
      return response.data;
    },
    enabled: !!selectedVersionId,
  });

  const publishVersionMutation = useMutation({
    mutationFn: async ({ versionId, newEdition, publicationDate }: { versionId: number; newEdition: boolean; publicationDate?: string }) => {
      return await api.post(`/product-versions/${versionId}/publish`, {
        newEdition,
        publicationDate: publicationDate || null,
      });
    },
    onMutate: async ({ versionId }) => {
      await queryClient.cancelQueries({ queryKey: ['productVersionsOpen', currentProductionLineId] });

      const previousVersions = queryClient.getQueryData<any[]>(['productVersionsOpen', currentProductionLineId]);

      queryClient.setQueryData<any[]>(['productVersionsOpen', currentProductionLineId], (old) =>
        (old || []).map((version: any) =>
          Number(version.id) === Number(versionId)
            ? { ...version, status: 'gepubliceerd' }
            : version
        )
      );

      return { previousVersions };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productVersionsOpen', currentProductionLineId] });
      queryClient.invalidateQueries({ queryKey: ['productVersionDetail', selectedVersionId] });
      setSelectedVersionId(null);
      setNewEditionOnPublish(false);
      setPublishDateOnPublish('');
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousVersions) {
        queryClient.setQueryData(['productVersionsOpen', currentProductionLineId], context.previousVersions);
      }
      alert(getApiErrorMessage(error, 'Publiceren van productversie mislukt'));
    },
  });

  const updateTaskExecutionStatusMutation = useMutation({
    mutationFn: async ({ versionId, taskId, executionStatus }: { versionId: number; taskId: number; executionStatus: string }) => {
      return await api.patch(`/product-versions/${versionId}/tasks/${taskId}/execution-status`, {
        executionStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productVersionDetail', selectedVersionId] });
    },
    onError: (error: any) => {
      alert(getApiErrorMessage(error, 'Bijwerken uitvoeringstatus mislukt'));
    },
  });

  const createVersionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProductIdForCreate) {
        throw new Error('Selecteer eerst een product');
      }

      const edition = Math.max(0, Number(editionNumber || '0'));
      const update = Math.max(0, Number(updateNumber || '0'));
      const composedVersionNumber = `Edition ${String(edition).padStart(2, '0')} Update ${String(update).padStart(2, '0')}`;

      const selectedProduct = visibleProducts.find(
        (product: any) => Number(product.id) === Number(selectedProductIdForCreate)
      );
      const isBaz2Product = String(selectedProduct?.code || '').trim().toLowerCase() === 'baz-2';
      const isPublCreate = (currentLine?.code || '').toUpperCase() === 'PUBL';
      const isCorrectionListCreate = isPublCreate && isCorrectionListProduct(selectedProduct?.code, selectedProduct?.name);

      const payload: any = {
        productId: selectedProductIdForCreate,
        status: createVersionStatus,
        versionDate: versionDate || null,
        notes: createNotes || null,
      };

      const isChartCreate = isSelectedChart;

      if (!(isPublCreate && (isBaz2Product || isCorrectionListCreate)) && !isChartCreate) {
        payload.versionNumber = composedVersionNumber;
      }

      return await api.post('/product-versions', payload);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['productVersionsOpen', currentProductionLineId] });
      const createdId = Number(response?.data?.id);
      if (createdId) {
        setSelectedVersionId(createdId);
      }
      setEditionNumber('01');
      setUpdateNumber('00');
      setCreateVersionStatus('in behandeling');
      setVersionDate('');
      setCreateNotes('');
    },
    onError: (error: any) => {
      alert(getApiErrorMessage(error, 'Aanmaken productversie mislukt'));
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedVersionId) {
        throw new Error('Geen productversie geselecteerd');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/product-versions/${selectedVersionId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data;
    },
    onSuccess: () => {
      setAttachmentFile(null);
      queryClient.invalidateQueries({ queryKey: ['productVersionAttachments', selectedVersionId] });
    },
    onError: (error: any) => {
      alert(getApiErrorMessage(error, 'Upload van bijlage mislukt'));
    },
  });

  const updateVersionStatusMutation = useMutation({
    mutationFn: async ({ versionId, status }: { versionId: number; status: 'in behandeling' | 'in inspectie' }) => {
      return await api.patch(`/product-versions/${versionId}/status`, { status });
    },
    onMutate: async ({ versionId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['productVersionsOpen', currentProductionLineId] });
      await queryClient.cancelQueries({ queryKey: ['productVersionDetail', selectedVersionId] });

      const previousVersions = queryClient.getQueryData<any[]>(['productVersionsOpen', currentProductionLineId]);
      const previousDetail = queryClient.getQueryData<any>(['productVersionDetail', selectedVersionId]);

      queryClient.setQueryData<any[]>(['productVersionsOpen', currentProductionLineId], (old) =>
        (old || []).map((version: any) =>
          Number(version.id) === Number(versionId)
            ? { ...version, status }
            : version
        )
      );

      queryClient.setQueryData<any>(['productVersionDetail', selectedVersionId], (old: any) => {
        if (!old || Number(old.id) !== Number(versionId)) return old;
        return { ...old, status };
      });

      return { previousVersions, previousDetail };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productVersionsOpen', currentProductionLineId] });
      queryClient.invalidateQueries({ queryKey: ['productVersionDetail', selectedVersionId] });
    },
    onError: (error: any, _variables, context) => {
      if (context?.previousVersions) {
        queryClient.setQueryData(['productVersionsOpen', currentProductionLineId], context.previousVersions);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(['productVersionDetail', selectedVersionId], context.previousDetail);
      }
      alert(getApiErrorMessage(error, 'Bijwerken van productversie-status mislukt'));
    },
  });

  const openVersions = (versions || []).filter(
    (version: any) => !isProductVersionPublished(version.status) && !isIntegratedCorrectionListCode(version.product_code)
  );
  const filteredOpenVersions = openVersions.filter((version: any) => {
    const productCode = String(version.product_code || '');
    const productDescription = cleanProductDescription(version.product_description || '');
    const versionNumber = String(version.version_number || '');
    const versionDate = normalizeVersionDateForFilter(version.version_date);
    const statusLabel = getProductVersionStatusLabel(version.status);
    const createdBy = String(version.created_by_name || '');
    const notes = String(version.notes || '');

    if (colFilterProductCode && !includesText(productCode, colFilterProductCode)) return false;
    if (colFilterProductDescription && !includesText(productDescription, colFilterProductDescription)) return false;
    if (colFilterVersionNumber && !includesText(versionNumber, colFilterVersionNumber)) return false;
    if (colFilterVersionDate && versionDate !== colFilterVersionDate) return false;
    if (colFilterStatus && !includesText(statusLabel, colFilterStatus)) return false;
    if (colFilterCreatedBy && !includesText(createdBy, colFilterCreatedBy)) return false;
    if (colFilterNotes && !includesText(notes, colFilterNotes)) return false;

    return true;
  });

  const clearColumnFilters = () => {
    setColFilterProductCode('');
    setColFilterProductDescription('');
    setColFilterVersionNumber('');
    setColFilterVersionDatePicker('');
    setColFilterVersionDate('');
    setColFilterStatus('');
    setColFilterCreatedBy('');
    setColFilterNotes('');
  };

  const hasColumnFilters =
    !!colFilterProductCode ||
    !!colFilterProductDescription ||
    !!colFilterVersionNumber ||
    !!colFilterVersionDate ||
    !!colFilterStatus ||
    !!colFilterCreatedBy ||
    !!colFilterNotes;

  const totalResizableHeight = Math.max(560, Math.round(window.innerHeight * 0.75));
  const detailsSectionHeight = Math.max(
    MIN_DETAILS_SECTION_HEIGHT,
    totalResizableHeight - productsListHeight - SPLITTER_HEIGHT
  );

  const startSectionResize = (event: any) => {
    resizeStartRef.current = {
      startY: event.clientY,
      startHeight: productsListHeight,
    };
    setIsResizingSections(true);
    event.preventDefault();
  };

  const currentLine = (productionLines || []).find((line: any) => Number(line.id) === Number(currentProductionLineId));
  const isPublLine = (currentLine?.code || '').toUpperCase() === 'PUBL';
  const visibleProducts = (products || []).filter((product: any) => !(isPublLine && isIntegratedCorrectionListCode(product?.code)));
  // Fall back to list data so buttons are visible immediately on click, before detail query resolves
  const selectedVersionListData = (versions || []).find((v: any) => Number(v.id) === selectedVersionId);
  const selectedVersionProductCode = (selectedVersion || selectedVersionListData)?.product_code;
  const selectedVersionProductName = (selectedVersion || selectedVersionListData)?.product_name;
  const isSelectedVersionCorrectionList = isPublLine && isCorrectionListProduct(
    selectedVersionProductCode,
    selectedVersionProductName
  );
  const isSelectedVersionBaz2 = String(selectedVersionProductCode || '').trim().toLowerCase() === 'baz-2';

  const { data: correctionListPreview, isLoading: isLoadingCorrectionListPreview } = useQuery({
    queryKey: ['productVersionCorrectionListPreview', selectedVersionId],
    queryFn: async () => {
      const response = await api.get(`/product-versions/${selectedVersionId}/corrections-list`);
      return response.data;
    },
    enabled: !!selectedVersionId && !!isSelectedVersionCorrectionList,
  });

  const { data: baz2PublicationPreview, isLoading: isLoadingBaz2PublicationPreview } = useQuery({
    queryKey: ['productVersionBaz2PublicationPreview', selectedVersionId],
    queryFn: async () => {
      const response = await api.get(`/product-versions/${selectedVersionId}/baz2-publication`);
      return response.data;
    },
    enabled: !!selectedVersionId && !!isSelectedVersionBaz2,
  });

  const selectedProductForCreate = visibleProducts.find((product: any) => Number(product.id) === Number(selectedProductIdForCreate));
  const isSelectedVersionChart = String(selectedVersion?.product_type || '').trim().toLowerCase() === 'chart';
  const selectedProductCodeRaw = String(selectedProductForCreate?.code || '').trim().toLowerCase();
  const selectedProductNameRaw = String(selectedProductForCreate?.name || '').trim().toLowerCase();
  const normalizedSelectedProductCode = normalizeValue(selectedProductCodeRaw);
  const normalizedSelectedProductName = normalizeValue(selectedProductNameRaw);
  const isSelectedBaz2 = isPublLine && selectedProductCodeRaw === 'baz-2';
  const isSelectedLichtenlijst = isPublLine && (
    normalizedSelectedProductCode.includes('lichtenlijst') ||
    normalizedSelectedProductName.includes('lichtenlijst')
  );
  const isSelectedCorrectionList = isPublLine && isCorrectionListProduct(
    selectedProductForCreate?.code,
    selectedProductForCreate?.name
  );
  const isSelectedChart = String(selectedProductForCreate?.type || '').trim().toLowerCase() === 'chart';
  const isSelectedAutoVersionProduct = isSelectedBaz2 || isSelectedLichtenlijst || isSelectedCorrectionList || isSelectedChart;

  const baz2PreviewVersionNumber = (() => {
    if (!isSelectedBaz2 || !selectedProductIdForCreate) return '';

    const parseBaz2Version = (value: string | null | undefined): { year: number; issue: number } | null => {
      if (!value) return null;
      const match = String(value).trim().match(/^(\d{4})-(\d{2})$/);
      if (!match) return null;
      return { year: Number(match[1]), issue: Number(match[2]) };
    };

    const selectedProductVersions = (versions || []).filter(
      (version: any) => Number(version.product_id) === Number(selectedProductIdForCreate)
    );
    const latestParsed = parseBaz2Version(selectedProductVersions[0]?.version_number);

    if (!latestParsed) {
      return `${new Date().getFullYear()}-02`;
    }

    if (latestParsed.issue >= 26) {
      return `${latestParsed.year + 1}-02`;
    }

    return `${latestParsed.year}-${String(Math.max(2, latestParsed.issue + 1)).padStart(2, '0')}`;
  })();

  const lichtenlijstPreviewVersionNumber = (() => {
    if (!isSelectedLichtenlijst || !selectedProductIdForCreate) return '';

    const currentYear = new Date().getFullYear();
    const selectedProductVersions = (versions || []).filter(
      (version: any) => Number(version.product_id) === Number(selectedProductIdForCreate)
    );

    let maxIssue = 0;

    for (const version of selectedProductVersions) {
      const value = String(version.version_number || '').trim();
      const match = value.match(/^(\d{4})-(\d{2})$/);
      if (!match) continue;

      const year = Number(match[1]);
      const issue = Number(match[2]);

      if (year !== currentYear) continue;
      if (issue > maxIssue) maxIssue = issue;
    }

    return `${currentYear}-${String(maxIssue + 1).padStart(2, '0')}`;
  })();

  const chartPreviewVersionNumber = (() => {
    if (!isSelectedChart || !selectedProductForCreate) return '';
    const name = String(selectedProductForCreate.name || '').trim();
    return `${name}_DD/MM/YYYY`;
  })();

  const correctionListPreviewVersionNumber = (() => {
    if (!isSelectedCorrectionList || !selectedProductIdForCreate) return '';

    const parseEditionVersion = (value: string | null | undefined): { edition: number; update: number } | null => {
      if (!value) return null;
      const match = String(value).trim().match(/edition\s*(\d+)\s*update\s*(\d+)/i);
      if (!match) return null;
      return { edition: Number(match[1]), update: Number(match[2]) };
    };

    const selectedProductVersions = (versions || []).filter(
      (version: any) => Number(version.product_id) === Number(selectedProductIdForCreate)
    );
    const latestParsed = parseEditionVersion(selectedProductVersions[0]?.version_number);

    if (!latestParsed) {
      return 'Edition 01 Update 00';
    }

    return `Edition ${String(latestParsed.edition).padStart(2, '0')} Update ${String(latestParsed.update + 1).padStart(2, '0')}`;
  })();

  const handleDownloadVersionAttachment = async (attachmentId: number, originalFilename: string) => {
    if (!selectedVersionId) return;

    try {
      const response = await api.get(`/product-versions/${selectedVersionId}/attachments/${attachmentId}/download`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalFilename || `attachment-${attachmentId}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(getApiErrorMessage(error, 'Download van bijlage mislukt'));
    }
  };

  if (!currentProductionLineId) {
    return (
      <div>
        <h1 className="page-title">Productversies</h1>
        <div className="alert alert-warning">
          Geen productielijn geselecteerd. Selecteer eerst een productielijn om open productversies te bekijken.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className={`page-title${!!currentProductionLineId && !isDefaultLine ? ' page-title--non-default' : ''}`}>
        Productversies
        {activeLineName && (
          <span className="page-title__production-line">
            {' — '}{activeLineName}
            {isDefaultLine && <span className="page-title__default-badge"> (standaard)</span>}
          </span>
        )}
      </h1>

      <div
        style={{
          marginBottom: '1rem',
          backgroundColor: 'white',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <h2
          onClick={() => setIsCreateVersionCollapsed((prev) => !prev)}
          style={{
            marginBottom: isCreateVersionCollapsed ? 0 : '0.75rem',
            color: '#343a40',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            userSelect: 'none',
          }}
        >
          <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: isCreateVersionCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
            ▼
          </span>
          Nieuwe Productversie
        </h2>
        {!isCreateVersionCollapsed && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.35rem', color: '#495057', fontWeight: 600 }}>Product</label>
            <select
              value={selectedProductIdForCreate || ''}
              onChange={(e) => setSelectedProductIdForCreate(Number(e.target.value) || null)}
              style={{ width: '100%', maxWidth: '420px' }}
            >
              <option value="">Selecteer product</option>
              {visibleProducts.map((product: any) => (
                <option key={product.id} value={product.id}>
                  {product.code} - {product.name}
                </option>
              ))}
            </select>
          </div>

          {isSelectedAutoVersionProduct ? (
            <div style={{ color: '#6c757d', fontSize: '0.9rem' }}>
              {isSelectedBaz2
                ? 'Versienummer (automatisch voor BaZ-2): '
                : isSelectedLichtenlijst
                ? 'Versienummer (automatisch voor Lichtenlijst): '
                : isSelectedChart
                ? 'Versienummer (automatisch voor zeekaart): '
                : 'Versienummer (automatisch voor Verbeterlijst): '}
              <strong>
                {isSelectedBaz2
                  ? (baz2PreviewVersionNumber || '-')
                  : isSelectedLichtenlijst
                  ? (lichtenlijstPreviewVersionNumber || '-')
                  : isSelectedChart
                  ? (chartPreviewVersionNumber || '-')
                  : (correctionListPreviewVersionNumber || '-')}
              </strong>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', color: '#495057', fontWeight: 600 }}>Edition</label>
                <input
                  type="number"
                  min={0}
                  value={editionNumber}
                  onChange={(e) => setEditionNumber(e.target.value)}
                  style={{ width: '120px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.35rem', color: '#495057', fontWeight: 600 }}>Update</label>
                <input
                  type="number"
                  min={0}
                  value={updateNumber}
                  onChange={(e) => setUpdateNumber(e.target.value)}
                  style={{ width: '120px' }}
                />
              </div>
              <div style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                Versienummer: <strong>Edition {String(Math.max(0, Number(editionNumber || '0'))).padStart(2, '0')} Update {String(Math.max(0, Number(updateNumber || '0'))).padStart(2, '0')}</strong>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', color: '#495057', fontWeight: 600 }}>Status</label>
              <select
                value={createVersionStatus}
                onChange={(e) => setCreateVersionStatus(e.target.value as 'in behandeling' | 'in inspectie')}
              >
                <option value="in behandeling">In behandeling</option>
                <option value="in inspectie">In inspectie</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', color: '#495057', fontWeight: 600 }}>Versiedatum</label>
              <input
                type="date"
                value={versionDate}
                onChange={(e) => setVersionDate(e.target.value)}
              />
            </div>
            <div style={{ minWidth: '320px', flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', color: '#495057', fontWeight: 600 }}>Opmerkingen</label>
              <input
                type="text"
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="Optionele opmerkingen"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              className="btn-success"
              disabled={createVersionMutation.isPending}
              onClick={() => createVersionMutation.mutate()}
            >
              {createVersionMutation.isPending ? 'Aanmaken...' : 'Versie aanmaken'}
            </button>
          </div>
        </div>
        )}
      </div>

      {isLoading ? (
        <p className="loading-text">Laden...</p>
      ) : openVersions.length === 0 ? (
        <div className="alert alert-warning">Geen open productversies gevonden voor de geselecteerde productielijn.</div>
      ) : (
        <div
          style={{
            backgroundColor: 'white',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            height: selectedVersionId ? `${productsListHeight}px` : undefined,
            overflow: selectedVersionId ? 'auto' : undefined,
          }}
        >
          <h2 style={{ marginBottom: '0.75rem', color: '#343a40' }}>
            {currentLine ? `${currentLine.code} - ${currentLine.name}` : 'Geselecteerde productielijn'}
          </h2>

          {hasColumnFilters && (
            <div style={{ marginBottom: '0.75rem' }}>
              <button type="button" className="btn-secondary" onClick={clearColumnFilters}>
                Kolomfilters wissen
              </button>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th>Productcode</th>
                <th>Productbeschrijving</th>
                <th>Versienummer</th>
                <th>Versiedatum</th>
                <th>Status</th>
                <th>Aangemaakt door</th>
                <th>Opmerkingen</th>
              </tr>
              <tr className="col-filter-row">
                <th style={{ padding: '0.25rem' }}>
                  <input
                    type="text"
                    value={colFilterProductCode}
                    onChange={(e) => setColFilterProductCode(e.target.value)}
                    placeholder="Filter"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                  />
                </th>
                <th style={{ padding: '0.25rem' }}>
                  <input
                    type="text"
                    value={colFilterProductDescription}
                    onChange={(e) => setColFilterProductDescription(e.target.value)}
                    placeholder="Filter"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                  />
                </th>
                <th style={{ padding: '0.25rem' }}>
                  <input
                    type="text"
                    value={colFilterVersionNumber}
                    onChange={(e) => setColFilterVersionNumber(e.target.value)}
                    placeholder="Filter"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                  />
                </th>
                <th style={{ padding: '0.25rem' }}>
                  <input
                    type="date"
                    value={colFilterVersionDatePicker}
                    onChange={(e) => {
                      const pickerValue = e.target.value;
                      setColFilterVersionDatePicker(pickerValue);

                      if (!pickerValue) {
                        setColFilterVersionDate('');
                        return;
                      }

                      const [year, month, day] = pickerValue.split('-');
                      setColFilterVersionDate(`${day}-${month}-${year}`);
                    }}
                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                  />
                </th>
                <th style={{ padding: '0.25rem' }}>
                  <select
                    value={colFilterStatus}
                    onChange={(e) => setColFilterStatus(e.target.value)}
                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                  >
                    <option value="">Alle</option>
                    <option value="in behandeling">In behandeling</option>
                    <option value="in inspectie">In inspectie</option>
                  </select>
                </th>
                <th style={{ padding: '0.25rem' }}>
                  <input
                    type="text"
                    value={colFilterCreatedBy}
                    onChange={(e) => setColFilterCreatedBy(e.target.value)}
                    placeholder="Filter"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                  />
                </th>
                <th style={{ padding: '0.25rem' }}>
                  <input
                    type="text"
                    value={colFilterNotes}
                    onChange={(e) => setColFilterNotes(e.target.value)}
                    placeholder="Filter"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOpenVersions.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#6c757d' }}>
                    Geen resultaten voor de actieve kolomfilters.
                  </td>
                </tr>
              )}
              {filteredOpenVersions.map((version: any) => (
                <tr
                  key={version.id}
                  onClick={() => setSelectedVersionId(Number(version.id))}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: selectedVersionId === Number(version.id) ? '#e7f3ff' : undefined,
                  }}
                >
                  <td>
                    {version.product_code || '-'}
                  </td>
                  <td>
                    {cleanProductDescription(version.product_description || '') || '-'}
                  </td>
                  <td>
                    <strong>{version.version_number}</strong>
                  </td>
                  <td>
                    {version.version_date
                      ? format(parseVersionDateValue(version.version_date) || new Date(version.version_date), 'dd/MM/yyyy')
                      : '-'}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '0.25em 0.5em',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        background: normalizeProductVersionStatus(version.status) === 'in inspectie' ? '#d6f0ff' : '#fff3cd',
                      }}
                    >
                      {getProductVersionStatusLabel(version.status)}
                    </span>
                  </td>
                  <td>{version.created_by_name || '-'}</td>
                  <td>{version.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedVersionId && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Hoogte aanpassen tussen productlijst en gekoppelde taken"
          onMouseDown={startSectionResize}
          style={{
            height: `${SPLITTER_HEIGHT}px`,
            marginTop: '0.75rem',
            marginBottom: '0.75rem',
            cursor: 'row-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '4px',
              borderRadius: '999px',
              background: isResizingSections ? '#7aa7d9' : '#d8e5f2',
              boxShadow: isResizingSections ? '0 0 0 1px #7aa7d9' : undefined,
            }}
          />
        </div>
      )}

      {selectedVersionId && (
        <div
          style={{
            backgroundColor: 'white',
            padding: '1rem',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            height: `${detailsSectionHeight}px`,
            overflow: 'auto',
          }}
        >
          {isSelectedVersionCorrectionList && (
            <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#f8fbff', borderRadius: '8px', border: '1px solid #d8e5f2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#16324f' }}>{correctionListLanguage === 'en' ? 'List of Corrections preview' : 'Verbeterlijst preview'}</h2>
                  <div style={{ color: '#516173', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                    Actieve BaZ-nrs. en artikeloverzicht voor deze productversie.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="action-btn action-btn--secondary"
                    onClick={() => setCorrectionListLanguage('nl')}
                    style={{ opacity: correctionListLanguage === 'nl' ? 1 : 0.7 }}
                  >
                    Nederlands
                  </button>
                  <button
                    type="button"
                    className="action-btn action-btn--secondary"
                    onClick={() => setCorrectionListLanguage('en')}
                    style={{ opacity: correctionListLanguage === 'en' ? 1 : 0.7 }}
                  >
                    English
                  </button>
                </div>
              </div>

              {isLoadingCorrectionListPreview ? (
                <p className="loading-text">{correctionListLanguage === 'en' ? 'Loading List of Corrections...' : 'Verbeterlijst laden...'}</p>
              ) : correctionListPreview ? (
                <>
                  <div style={{ marginBottom: '0.75rem', color: '#516173', fontSize: '0.9rem' }}>
                    Actieve BaZ-nrs.: <strong>{(correctionListPreview.activeBazNumbers || []).join(', ') || '-'}</strong>
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <button
                      type="button"
                      className="action-btn action-btn--primary"
                      onClick={() =>
                        openCorrectionListPrintPreview({
                          title: String(correctionListPreview.productName || selectedVersion?.product_name || (correctionListLanguage === 'en' ? 'List of Corrections' : 'Verbeterlijst')),
                          html: String(correctionListPreview[correctionListLanguage]?.html || ''),
                          language: correctionListLanguage,
                        })
                      }
                      disabled={!correctionListPreview[correctionListLanguage]?.html}
                    >
                      Print A4 (PDF)
                    </button>
                  </div>
                  <div
                    style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #d8e5f2', maxHeight: '420px', overflow: 'auto' }}
                    dangerouslySetInnerHTML={{ __html: sanitizePublicationHtmlForDisplay(correctionListPreview[correctionListLanguage]?.html || '') }}
                  />
                </>
              ) : (
                <p style={{ margin: 0, color: '#6c757d' }}>{correctionListLanguage === 'en' ? 'No List of Corrections preview available.' : 'Geen verbeterlijstpreview beschikbaar.'}</p>
              )}
            </div>
          )}

          {isSelectedVersionBaz2 && (
            <div style={{ marginBottom: '1.25rem', padding: '1rem', backgroundColor: '#f8fbff', borderRadius: '8px', border: '1px solid #d8e5f2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#16324f' }}>{baz2PublicationLanguage === 'en' ? 'BaZ-2 publication preview' : 'BaZ-2 publicatie preview'}</h2>
                  <div style={{ color: '#516173', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                    Lijst van MSI-actieve items en volledige BaZ-artikelen voor deze versie.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="action-btn action-btn--secondary"
                    onClick={() => setBaz2PublicationLanguage('nl')}
                    style={{ opacity: baz2PublicationLanguage === 'nl' ? 1 : 0.7 }}
                  >
                    Nederlands
                  </button>
                  <button
                    type="button"
                    className="action-btn action-btn--secondary"
                    onClick={() => setBaz2PublicationLanguage('en')}
                    style={{ opacity: baz2PublicationLanguage === 'en' ? 1 : 0.7 }}
                  >
                    English
                  </button>
                </div>
              </div>

              {isLoadingBaz2PublicationPreview ? (
                <p className="loading-text">{baz2PublicationLanguage === 'en' ? 'Loading BaZ-2 publication...' : 'BaZ-2 publicatie laden...'}</p>
              ) : baz2PublicationPreview ? (
                <>
                  <div style={{ marginBottom: '0.75rem', color: '#516173', fontSize: '0.9rem' }}>
                    MSI actief: <strong>{(baz2PublicationPreview.msiTasks || []).length}</strong> taak/taken
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <button
                      type="button"
                      className="action-btn action-btn--primary"
                      onClick={() =>
                        openCorrectionListPrintPreview({
                          title: String(baz2PublicationPreview.productName || selectedVersion?.product_name || (baz2PublicationLanguage === 'en' ? 'BaZ-2 publication' : 'BaZ-2 publicatie')),
                          html: String(baz2PublicationPreview[baz2PublicationLanguage]?.html || ''),
                          language: baz2PublicationLanguage,
                        })
                      }
                      disabled={!baz2PublicationPreview[baz2PublicationLanguage]?.html}
                    >
                      Print A4 (PDF)
                    </button>
                  </div>
                  <div
                    style={{ padding: '1rem', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #d8e5f2', maxHeight: '420px', overflow: 'auto' }}
                    dangerouslySetInnerHTML={{ __html: sanitizePublicationHtmlForDisplay(baz2PublicationPreview[baz2PublicationLanguage]?.html || '') }}
                  />
                </>
              ) : (
                <p style={{ margin: 0, color: '#6c757d' }}>{baz2PublicationLanguage === 'en' ? 'No BaZ-2 publication preview available.' : 'Geen BaZ-2 publicatiepreview beschikbaar.'}</p>
              )}
            </div>
          )}

          <div
            aria-hidden="true"
            style={{
              margin: '1.5rem 0',
              borderTop: '1px solid #d8e5f2',
            }}
          />

          <h2 style={{ marginBottom: '0.75rem', color: '#343a40' }}>
            Gekoppelde taken
          </h2>

          {!!selectedVersion && (
            <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#343a40' }}>
                status
                <select
                  value={normalizeProductVersionStatus(selectedVersion?.status)}
                  onChange={(e) => {
                    const nextStatus = e.target.value as 'in behandeling' | 'in inspectie' | 'gepubliceerd';

                    if (!selectedVersionId) return;

                    if (nextStatus === 'gepubliceerd') {
                      if (isSelectedVersionChart && !publishDateOnPublish) {
                        alert('Selecteer een publicatiedatum voor Chart-producten');
                        return;
                      }

                      publishVersionMutation.mutate({
                        versionId: selectedVersionId,
                        newEdition: newEditionOnPublish,
                        publicationDate: publishDateOnPublish,
                      });
                      return;
                    }

                    updateVersionStatusMutation.mutate({
                      versionId: selectedVersionId,
                      status: nextStatus,
                    });
                  }}
                  disabled={updateVersionStatusMutation.isPending || publishVersionMutation.isPending}
                >
                  <option value="in behandeling">In behandeling</option>
                  <option value="in inspectie">In inspectie</option>
                  <option value="gepubliceerd">Gepubliceerd</option>
                </select>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#343a40' }}>
                <input
                  type="checkbox"
                  checked={newEditionOnPublish}
                  onChange={(e) => setNewEditionOnPublish(e.target.checked)}
                />
                nieuwe editie
              </label>

              <button
                type="button"
                className="btn-success"
                onClick={() => {
                  if (!selectedVersionId) return;

                  if (isSelectedVersionChart && !publishDateOnPublish) {
                    alert('Selecteer een publicatiedatum voor Chart-producten');
                    return;
                  }

                  publishVersionMutation.mutate({
                    versionId: selectedVersionId,
                    newEdition: newEditionOnPublish,
                    publicationDate: publishDateOnPublish,
                  });
                }}
                disabled={publishVersionMutation.isPending || (isSelectedVersionChart && !publishDateOnPublish)}
              >
                {publishVersionMutation.isPending ? 'Publiceren...' : 'Publiceren'}
              </button>

              {isSelectedVersionChart && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#343a40' }}>
                  publicatiedatum
                  <input
                    type="date"
                    value={publishDateOnPublish}
                    onChange={(e) => setPublishDateOnPublish(e.target.value)}
                    style={{ padding: '0.3rem 0.45rem' }}
                  />
                </label>
              )}
            </div>
          )}

          {isLoadingSelectedVersion ? (
            <p className="loading-text">Laden...</p>
          ) : !selectedVersion?.tasks || selectedVersion.tasks.length === 0 ? (
            <p style={{ margin: 0, color: '#6c757d' }}>Geen taken gekoppeld aan deze productversie.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Taaknummer</th>
                  <th>Titel</th>
                  <th>{isPublLine ? 'BaZ artikel' : 'BaZ Nr.'}</th>
                  <th>Status</th>
                  <th>Uitvoering in product</th>
                  <th>Opmerkingen</th>
                </tr>
              </thead>
              <tbody>
                {selectedVersion.tasks.map((task: any) => (
                  <tr key={task.id}>
                    <td>
                      <Link
                        to={`/tasks?search=${task.task_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="task-tag"
                      >
                        {task.task_number}
                      </Link>
                    </td>
                    <td>{task.title}</td>
                    <td>
                      {Array.isArray(task.articles) && task.articles.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {task.articles.map((article: any) => (
                            <button
                              key={article.id}
                              type="button"
                              onClick={() => setPreviewArticle(article)}
                              className="action-btn action-btn--secondary"
                              style={{ padding: '0.12rem 0.45rem', fontSize: '0.8rem' }}
                              title="Toon artikel preview"
                            >
                              {article.baz_number}
                            </button>
                          ))}
                        </div>
                      ) : (
                        isPublLine ? (task.baz_articles || task.baz_number || '-') : (task.baz_number || '-')
                      )}
                    </td>
                    <td>{getTaskStatusLabel(task.status)}</td>
                    <td>
                      <select
                        value={task.execution_status || 'not_executed'}
                        onChange={(e) => {
                          if (!selectedVersionId) return;
                          if (e.target.value === 'executed' && task.status !== 'voltooid') {
                            alert("'uitgevoerd' is enkel mogelijk als taakstatus 'voltooid' is");
                            return;
                          }
                          updateTaskExecutionStatusMutation.mutate({
                            versionId: selectedVersionId,
                            taskId: task.id,
                            executionStatus: e.target.value,
                          });
                        }}
                        disabled={updateTaskExecutionStatusMutation.isPending}
                        style={{
                          minWidth: '180px',
                          borderRadius: '4px',
                          border: '1px solid #ced4da',
                          color: '#212529',
                          fontWeight: 600,
                          backgroundColor:
                            (task.execution_status || 'not_executed') === 'executed'
                              ? '#d4edda'
                              : (task.execution_status || 'not_executed') === 'not_applicable'
                              ? '#e9ecef'
                              : '#f8d7da',
                        }}
                      >
                        <option value="not_applicable">niet nodig</option>
                        <option value="executed" disabled={task.status !== 'voltooid'}>
                          uitgevoerd
                        </option>
                        <option value="not_executed">niet uitgevoerd</option>
                      </select>
                    </td>
                    <td>{task.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div
            aria-hidden="true"
            style={{
              margin: '1.5rem 0',
              borderTop: '1px solid #d8e5f2',
            }}
          />

          <h2 style={{ marginBottom: '0.75rem', color: '#343a40' }}>Bijlagen productversie</h2>

          <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="file"
                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                disabled={uploadAttachmentMutation.isPending}
              />
              <button
                type="button"
                className="btn-success"
                onClick={() => {
                  if (!attachmentFile) {
                    alert('Selecteer eerst een bestand');
                    return;
                  }
                  uploadAttachmentMutation.mutate(attachmentFile);
                }}
                disabled={uploadAttachmentMutation.isPending || !attachmentFile}
              >
                {uploadAttachmentMutation.isPending ? 'Uploaden...' : 'Bijlage uploaden'}
              </button>
            </div>
          </div>

          {isLoadingVersionAttachments ? (
            <p className="loading-text">Bijlagen laden...</p>
          ) : !versionAttachments || versionAttachments.length === 0 ? (
            <p style={{ marginTop: 0, marginBottom: '1rem', color: '#6c757d' }}>Nog geen bijlagen voor deze productversie.</p>
          ) : (
            <table style={{ marginBottom: '1.25rem' }}>
              <thead>
                <tr>
                  <th>Bestandsnaam</th>
                  <th>Type</th>
                  <th>Grootte</th>
                  <th>Geüpload door</th>
                  <th>Datum</th>
                  <th>Actie</th>
                </tr>
              </thead>
              <tbody>
                {versionAttachments.map((attachment: any) => (
                  <tr key={attachment.id}>
                    <td>{attachment.original_filename}</td>
                    <td>{attachment.file_type || '-'}</td>
                    <td>{attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} KB` : '-'}</td>
                    <td>{attachment.first_name ? `${attachment.first_name} ${attachment.last_name || ''}`.trim() : '-'}</td>
                    <td>{attachment.created_at ? format(new Date(attachment.created_at), 'dd/MM/yyyy HH:mm') : '-'}</td>
                    <td>
                      <button
                        type="button"
                        className="action-btn action-btn--primary"
                        onClick={() => handleDownloadVersionAttachment(attachment.id, attachment.original_filename)}
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!!selectedVersion && (selectedVersion.product_geometry || (selectedVersion.tasks?.length > 0 && selectedVersion.tasks.some((t: any) => t.notice_geometries?.length > 0))) && (
            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="action-btn action-btn--secondary"
                onClick={() => setIsMapCollapsed((prev) => !prev)}
                style={{ marginBottom: '0.75rem' }}
              >
                {isMapCollapsed ? 'Toon geografische overzichtskaart' : 'Verberg geografische overzichtskaart'}
              </button>

              {!isMapCollapsed && (
                <div>
                  <button
                    type="button"
                    className={isMapExpanded ? 'btn-secondary' : 'btn-primary'}
                    onClick={() => setIsMapExpanded(!isMapExpanded)}
                    style={{ marginBottom: '0.5rem' }}
                  >
                    {isMapExpanded ? 'Verklein kaart (Esc)' : 'Vergroot kaart'}
                  </button>
                  {isMapExpanded && (
                    <div style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      zIndex: 1000,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{
                        position: 'relative',
                        width: '95%',
                        height: '95%',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                      }}>
                        <div style={{
                          flex: 1,
                          overflow: 'hidden',
                        }}>
                          <ProductVersionMapOverview
                            selectedVersion={selectedVersion}
                            productName={selectedVersion.product_name}
                            productCode={selectedVersion.product_code}
                            isExpanded={true}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMapExpanded(false)}
                          style={{
                            padding: '0.5rem 1rem',
                            margin: '0.75rem',
                            alignSelf: 'flex-end',
                          }}
                        >
                          Sluiten (Esc)
                        </button>
                      </div>
                    </div>
                  )}
                  {!isMapExpanded && (
                    <ProductVersionMapOverview
                      selectedVersion={selectedVersion}
                      productName={selectedVersion.product_name}
                      productCode={selectedVersion.product_code}
                      isExpanded={false}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {previewArticle && (
        <div
          onClick={() => setPreviewArticle(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white', borderRadius: '8px', padding: '1.5rem',
              maxWidth: '90vw', width: 'fit-content', minWidth: '400px', maxHeight: '90vh', overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#343a40' }}>
                {previewArticle.baz_number}
                {previewArticle.is_temporary && <span style={{ color: '#fd7e14', fontWeight: 400, fontSize: '0.85rem', marginLeft: '0.5rem' }}>(Tijdelijk)</span>}
              </h3>
              <button
                onClick={() => setPreviewArticle(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#6c757d', padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nederlands</div>
                {previewArticle.title_nl && (
                  <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f0f7ff', border: '1px solid #bee5eb', borderRadius: '4px', fontSize: '0.95rem', fontWeight: 600, color: '#343a40', marginBottom: '0.5rem' }}>
                    {previewArticle.title_nl}
                  </div>
                )}
                <div
                  style={{ padding: '0.75rem', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.9rem', lineHeight: '1.6', color: '#343a40', minHeight: '60px' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(previewArticle.content_nl || '<em style="color:#6c757d">Geen inhoud</em>') }}
                />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#495057', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>English</div>
                {previewArticle.title_en && (
                  <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f0f7ff', border: '1px solid #bee5eb', borderRadius: '4px', fontSize: '0.95rem', fontWeight: 600, color: '#343a40', marginBottom: '0.5rem' }}>
                    {previewArticle.title_en}
                  </div>
                )}
                <div
                  style={{ padding: '0.75rem', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.9rem', lineHeight: '1.6', color: '#343a40', minHeight: '60px' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtmlForDisplay(previewArticle.content_en || '<em style="color:#6c757d">No content</em>') }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
