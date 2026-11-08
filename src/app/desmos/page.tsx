'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { CorePracticeUI, PracticeQuestion } from '@/components/CorePracticeUI';
import { useToast } from '@/context/ToastContext';

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (
        element: HTMLElement,
        options?: Record<string, unknown>
      ) => DesmosCalculatorInstance;
    };
  }
}

interface DesmosExpression {
  id: string;
  latex: string;
  color?: string;
  sliderBounds?: { min: number; max: number; step?: number };
}

interface DesmosCalculatorInstance {
  setExpression: (expr: DesmosExpression) => void;
  removeExpression: (expr: { id: string }) => void;
  setBlank: () => void;
  destroy: () => void;
  setDefaultState?: () => void;
  setViewport?: (bounds: [number, number, number, number]) => void;
}

interface DesmosShortcut {
  title: string;
  syntax: string;
  latex: string;
  desc: string;
  category: 'regression' | 'stats' | 'geometry' | 'hotkey' | 'algebra' | 'extremum';
  multiExpr?: DesmosExpression[];
}

export default function DesmosPage() {
  const { showToast } = useToast();
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [currentSkillId, setCurrentSkillId] = useState<string | null>(null);
  const [questionData, setQuestionData] = useState<PracticeQuestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const prefetchedRef = useRef<{ topic: string; promise: Promise<PracticeQuestion | null> } | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  // Desmos API Native State & Refs
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isSdkOffline, setIsSdkOffline] = useState(false);
  const calculatorRef = useRef<DesmosCalculatorInstance | null>(null);
  const calcContainerRef = useRef<HTMLDivElement | null>(null);

  // Huấn luyện 3 Bước Bấm Máy 15 Giây (Interactive Guided Hack)
  const [activeScenario, setActiveScenario] = useState<'slider' | 'regression' | 'intersection'>('slider');
  const [guidedStep, setGuidedStep] = useState<1 | 2 | 3>(1);

  // Tải Desmos JS SDK v1.9 Native
  useEffect(() => {
    let isMounted = true;

    const initCalculator = () => {
      if (window.Desmos && calcContainerRef.current) {
        try {
          if (!calculatorRef.current) {
            calculatorRef.current = window.Desmos.GraphingCalculator(calcContainerRef.current, {
              keypad: true,
              expressions: true,
              settingsMenu: true,
              zoomButtons: true,
              border: false,
              fontSize: 13,
            });
          }
          if (isMounted) {
            setIsSdkLoaded(true);
            setIsSdkOffline(false);
          }
        } catch (err) {
          console.warn("Lỗi khởi tạo Desmos SDK, chuyển sang iframe:", err);
          if (isMounted) setIsSdkOffline(true);
        }
      }
    };

    if (window.Desmos) {
      initCalculator();
      return;
    }

    const scriptSrc = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
    const existing = document.querySelector(`script[src*="calculator.js"]`);
    if (existing) {
      existing.addEventListener('load', () => {
        if (isMounted) initCalculator();
      });
      existing.addEventListener('error', () => {
        if (isMounted) setIsSdkOffline(true);
      });
      return;
    }

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => {
      if (isMounted) initCalculator();
    };
    script.onerror = () => {
      console.warn("Không thể tải Desmos SDK v1.9, chuyển chế độ iframe offline.");
      if (isMounted) setIsSdkOffline(true);
    };
    document.head.appendChild(script);

    return () => {
      isMounted = false;
      if (calculatorRef.current) {
        try {
          calculatorRef.current.destroy();
        } catch {
          // ignore
        }
        calculatorRef.current = null;
      }
    };
  }, []);

  // Re-attach calculator container khi view thay đổi
  const attachContainerRef = useCallback((node: HTMLDivElement | null) => {
    calcContainerRef.current = node;
    if (node && window.Desmos && !calculatorRef.current) {
      try {
        calculatorRef.current = window.Desmos.GraphingCalculator(node, {
          keypad: true,
          expressions: true,
          settingsMenu: true,
          zoomButtons: true,
          border: false,
          fontSize: 13,
        });
        setIsSdkLoaded(true);
      } catch (e) {
        console.warn("Failed to mount Desmos instance:", e);
        setIsSdkOffline(true);
      }
    }
  }, []);

  // 1-Click nạp biểu thức vào Desmos
  const injectExpressions = (
    expressions: DesmosExpression[], 
    label: string, 
    preserveExisting = false
  ) => {
    if (calculatorRef.current) {
      if (!preserveExisting) {
        calculatorRef.current.setBlank();
      }
      expressions.forEach((expr) => {
        calculatorRef.current?.setExpression(expr);
      });
      showToast(`⚡ Đã tự động nạp vào Desmos: ${label}`, 'success');
    } else {
      // Fallback copy to clipboard
      const plain = expressions.map(e => e.latex).join(' ; ');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(plain);
        showToast(`📋 Đã chép biểu thức: ${label} (Dán vào Desmos bằng Ctrl+V)`, 'info');
      }
    }
  };

  const handleClearCalculator = () => {
    if (calculatorRef.current) {
      calculatorRef.current.setBlank();
      showToast("🧹 Đã làm sạch máy tính Desmos!", 'info');
    }
  };

  // 6 Chủ đề luyện thi Desmos
  const categories = [
    { 
      id: "algebra_systems",
      name: "Hệ Phương Trình Bậc Nhất", 
      desc: "Sử dụng Desmos tìm giao điểm hai đường thẳng trong nháy mắt.", 
      skillId: "algebra.systems",
      icon: "📐"
    },
    { 
      id: "advanced_quadratic",
      name: "Parabola & Điểm Đỉnh", 
      desc: "Tìm min/max, tọa độ đỉnh vertex (-b/2a) bằng đồ thị cực nhanh.", 
      skillId: "advanced.quadratic",
      icon: "📈"
    },
    { 
      id: "constant_k_slider",
      name: "Bẫy Hằng Số K (Slider)", 
      desc: "Sử dụng thanh trượt (slider) k để biện luận số nghiệm của phương trình.", 
      skillId: "algebra.systems",
      icon: "🎚️"
    },
    { 
      id: "desmos_regression",
      name: "Hồi quy Bảng số liệu (y₁ ~ mx₁ + b & ax₁² + bx₁ + c)", 
      desc: "Dùng ký hiệu ~ tìm hàm số đi qua bảng điểm trong 10 giây chuẩn tuyệt đối.", 
      skillId: "problem_solving.scatterplots",
      icon: "📊"
    },
    { 
      id: "desmos_circle_inequality",
      name: "Phương trình Đường tròn & Miền nghiệm Bất phương trình", 
      desc: "Vẽ đường tròn (x-h)² + (y-k)² = r² và tô miền nghiệm hệ bất phương trình.", 
      skillId: "geometry.circles",
      icon: "⭕"
    },
    { 
      id: "desmos_statistics",
      name: "Thống kê Thực chiến (mean, median, stdev, boxplot)", 
      desc: "Giải nhanh bài toán trung bình, trung vị, độ lệch chuẩn không cần tính tay.", 
      skillId: "problem_solving.statistics",
      icon: "📉"
    }
  ];

  // Kho 10 Bí Kíp Desmos Thực Chiến Chuẩn Bluebook SAT 2026 (1-Click Nạp & Vẽ Tự Động)
  const desmosFormulas: DesmosShortcut[] = [
    {
      title: "1. Hồi quy Tuyến tính (Linear Regression)",
      syntax: "y_1 ~ m x_1 + b",
      latex: "y_1\\sim mx_1+b",
      desc: "Tạo bảng x_1, y_1 -> Desmos tự tìm hệ số góc m và hệ số tự do b chuẩn xác trong 5 giây",
      category: "regression",
      multiExpr: [
        { id: 'tbl_x', latex: 'x_1=[1,2,3,4,5]' },
        { id: 'tbl_y', latex: 'y_1=[3,5,7,9,11]' },
        { id: 'reg_line', latex: 'y_1\\sim mx_1+b' }
      ]
    },
    {
      title: "2. Hồi quy Parabol Bậc 2 (Quadratic Regression)",
      syntax: "y_1 ~ a x_1^2 + b x_1 + c",
      latex: "y_1\\sim ax_1^2+bx_1+c",
      desc: "Tự động tìm hệ số a, b, c của parabol đi qua bảng số liệu trong đề thi",
      category: "regression",
      multiExpr: [
        { id: 'tbl_qx', latex: 'x_1=[-1,0,1,2]' },
        { id: 'tbl_qy', latex: 'y_1=[3,1,3,9]' },
        { id: 'reg_quad', latex: 'y_1\\sim ax_1^2+bx_1+c' }
      ]
    },
    {
      title: "3. Hồi quy Hàm Mũ Tăng Trưởng (Exponential)",
      syntax: "y_1 ~ a b^{x_1}",
      latex: "y_1\\sim ab^{x_1}",
      desc: "Xác định hệ số ban đầu a và cơ số tăng trưởng b cho bài toán lãi kép, dân số, phân rã",
      category: "regression",
      multiExpr: [
        { id: 'exp_x', latex: 'x_1=[0,1,2,3]' },
        { id: 'exp_y', latex: 'y_1=[100,150,225,337.5]' },
        { id: 'exp_reg', latex: 'y_1\\sim ab^{x_1}' }
      ]
    },
    {
      title: "4. Trung bình cộng Danh sách (Mean)",
      syntax: "mean([12, 15, 18, 22, 25])",
      latex: "m=\\operatorname{mean}([12, 15, 18, 22, 25])",
      desc: "Tính kỳ vọng / trung bình danh sách số liệu không cần cộng chia tay, triệt tiêu sai sót",
      category: "stats",
      multiExpr: [
        { id: 'mean_expr', latex: 'm=\\operatorname{mean}([12, 15, 18, 22, 25])' }
      ]
    },
    {
      title: "5. Trung vị & Phân vị (Median & Quartiles)",
      syntax: "median([12, 15, 18, 22, 25])",
      latex: "M=\\operatorname{median}([12, 15, 18, 22, 25])",
      desc: "Tìm số đứng giữa danh sách phân phối và xác định Q1, Q2, Q3 trong nháy mắt",
      category: "stats",
      multiExpr: [
        { id: 'med_expr', latex: 'M=\\operatorname{median}([12, 15, 18, 22, 25])' }
      ]
    },
    {
      title: "6. Độ lệch chuẩn & Biểu đồ Hộp (Stdev & Boxplot)",
      syntax: "stdev([12, 15, 18, 22, 25])",
      latex: "s=\\operatorname{stdev}([12, 15, 18, 22, 25])",
      desc: "Đo độ phân tán của dữ liệu và vẽ biểu đồ hộp phát hiện Outlier cực nhanh",
      category: "stats",
      multiExpr: [
        { id: 'stdev_expr', latex: 's=\\operatorname{stdev}([12, 15, 18, 22, 25])' },
        { id: 'box_expr', latex: '\\operatorname{boxplot}([12, 15, 18, 22, 25])' }
      ]
    },
    {
      title: "7. Phương trình Đường tròn Chuẩn (Circle Equation)",
      syntax: "(x - 2)^2 + (y + 3)^2 = 25",
      latex: "(x - 2)^2 + (y + 3)^2 = 25",
      desc: "Tâm (h, k) = (2, -3), Bán kính r = 5. Nhìn ngay giao điểm với các trục tọa độ",
      category: "geometry",
      multiExpr: [
        { id: 'circle_eq', latex: '(x - 2)^2 + (y + 3)^2 = 25' },
        { id: 'circle_center', latex: '(2, -3)' }
      ]
    },
    {
      title: "8. Miền nghiệm Hệ Bất Phương Trình (Inequality)",
      syntax: "y >= 2x - 3 {x > 0}",
      latex: "y \\ge 2x - 3\\left\\{x>0\\right\\}",
      desc: "Tô miền nghiệm trực quan và giới hạn điều kiện x > 0 để kiểm tra các điểm nghiệm",
      category: "geometry",
      multiExpr: [
        { id: 'ineq_1', latex: 'y\\ge 2x - 3\\left\\{x>0\\right\\}' },
        { id: 'ineq_2', latex: 'y\\le -x + 4' }
      ]
    },
    {
      title: "9. Parabola Đỉnh Vertex & Điểm Cực Trị (Max/Min)",
      syntax: "f(x) = -2(x - 3)^2 + 8",
      latex: "f(x) = -2(x - 3)^2 + 8",
      desc: "Desmos tự động định vị chấm xám tại đỉnh (3, 8), giá trị lớn nhất y = 8 đạt tại x = 3",
      category: "extremum",
      multiExpr: [
        { id: 'parab_v', latex: 'f(x) = -2(x - 3)^2 + 8' },
        { id: 'vertex_pt', latex: '(3, 8)' }
      ]
    },
    {
      title: "10. Bẫy Hằng Số K với Thanh Trượt Slider (Slider Hack)",
      syntax: "y = 2x + k  &  y = -x^2 + 4",
      latex: "y = 2x + k",
      desc: "Biện luận số nghiệm của hệ phương trình bằng cách trượt k để tìm điểm tiếp xúc duy nhất",
      category: "algebra",
      multiExpr: [
        { id: 'line_k', latex: 'y = 2x + k' },
        { id: 'parab_k', latex: 'y = -x^2 + 4' },
        { id: 'slider_k', latex: 'k = 5', sliderBounds: { min: -10, max: 10, step: 0.1 } }
      ]
    }
  ];

  const desmosKeyTips = [
    { key: "~", name: "Dấu Ngã (Tilde)", usage: "Hồi quy dữ liệu (Shift + `)" },
    { key: "^", name: "Lũy thừa", usage: "Gõ x^2 hoặc x^3" },
    { key: "_", name: "Chỉ số dưới (Subscript)", usage: "Gõ y_1 hoặc x_1" },
    { key: "/", name: "Phân số", usage: "Tạo phân số tử / mẫu" },
    { key: "sqrt", name: "Căn bậc hai", usage: "Gõ sqrt rồi mở ngoặc" },
    { key: "pi", name: "Số Pi", usage: "Gõ pi tự động thành π" },
  ];

  // Kịch bản Huấn luyện 3 Bước Bấm Máy 15 Giây
  const trainingScenarios = {
    slider: {
      title: "Kịch bản 1: Bẫy Hằng Số k — Tìm k để Hệ có đúng 1 nghiệm (Tiếp xúc)",
      question: "Cho hệ phương trình: y = 2x + k và y = -x² + 4. Với giá trị nào của k thì hệ có đúng một nghiệm duy nhất?",
      steps: [
        {
          step: 1,
          name: "Bước 1: Nhập Parabol & Đường thẳng chứa k",
          desc: "Nạp Parabol cố định y = -x² + 4 và đường thẳng y = 2x + k vào máy tính.",
          actionText: "▶️ Nạp Hàm Bước 1 Vào Desmos",
          action: () => {
            injectExpressions([
              { id: 'step1_parab', latex: 'y = -x^2 + 4', color: '#2563eb' },
              { id: 'step1_line', latex: 'y = 2x + k', color: '#dc2626' }
            ], "Bước 1: Nhập Hàm");
          }
        },
        {
          step: 2,
          name: "Bước 2: Kích hoạt Thanh Trượt Slider k",
          desc: "Khai báo thanh trượt k từ -10 đến 10. Desmos cho phép trượt giá trị k trực tiếp trên đồ thị.",
          actionText: "▶️ Thêm Slider k (Bước 2)",
          action: () => {
            injectExpressions([
              { id: 'step1_parab', latex: 'y = -x^2 + 4', color: '#2563eb' },
              { id: 'step1_line', latex: 'y = 2x + k', color: '#dc2626' },
              { id: 'step2_slider', latex: 'k = 5', sliderBounds: { min: -10, max: 10, step: 0.1 } }
            ], "Bước 2: Slider k");
          }
        },
        {
          step: 3,
          name: "Bước 3: Nhìn điểm tiếp xúc & Đọc ngay k = 5",
          desc: "Quan sát khi k = 5, đường thẳng tiếp xúc với parabol tại đúng 1 điểm duy nhất (-1, 2). Chốt ngay k = 5 trong 15 giây!",
          actionText: "▶️ Khóa Nghiệm Điểm Tiếp Xúc (-1, 2)",
          action: () => {
            injectExpressions([
              { id: 'step1_parab', latex: 'y = -x^2 + 4', color: '#2563eb' },
              { id: 'step1_line', latex: 'y = 2x + 5', color: '#dc2626' },
              { id: 'step3_pt', latex: '(-1, 2)', color: '#10b981' }
            ], "Bước 3: Khóa Nghiệm");
          }
        }
      ]
    },
    regression: {
      title: "Kịch bản 2: Hồi quy Dấu Ngã ~ — Tìm Hàm Số Đi Qua Bảng Dữ Liệu",
      question: "Bảng cho các điểm (1, 3), (2, 5), (3, 7), (4, 9). Tìm hệ số góc m và hệ số tự do b của đường thẳng biểu diễn dữ liệu.",
      steps: [
        {
          step: 1,
          name: "Bước 1: Nạp Bảng số liệu x₁ và y₁",
          desc: "Nhập danh sách tọa độ x₁ = [1, 2, 3, 4] và y₁ = [3, 5, 7, 9] vào Desmos.",
          actionText: "▶️ Nạp Bảng Tọa Độ (Bước 1)",
          action: () => {
            injectExpressions([
              { id: 'reg_x', latex: 'x_1=[1,2,3,4]' },
              { id: 'reg_y', latex: 'y_1=[3,5,7,9]' }
            ], "Bước 1: Nạp Bảng Tọa Độ");
          }
        },
        {
          step: 2,
          name: "Bước 2: Gõ phương trình hồi quy y₁ ~ m x₁ + b",
          desc: "Dùng dấu ngã (~) thay cho dấu bằng (=). Desmos tự động giải hệ số m và b.",
          actionText: "▶️ Bắn Công Thức Hồi Quy ~ (Bước 2)",
          action: () => {
            injectExpressions([
              { id: 'reg_x', latex: 'x_1=[1,2,3,4]' },
              { id: 'reg_y', latex: 'y_1=[3,5,7,9]' },
              { id: 'reg_expr', latex: 'y_1\\sim mx_1+b' }
            ], "Bước 2: Hồi quy Dấu Ngã");
          }
        },
        {
          step: 3,
          name: "Bước 3: Đọc ngay m = 2 và b = 1",
          desc: "Bảng tham số Desmos hiện m = 2, b = 1, r² = 1. Kết luận phương trình y = 2x + 1 không cần giải tay!",
          actionText: "▶️ Đồ Thị Đường Chuẩn y = 2x + 1",
          action: () => {
            injectExpressions([
              { id: 'reg_x', latex: 'x_1=[1,2,3,4]' },
              { id: 'reg_y', latex: 'y_1=[3,5,7,9]' },
              { id: 'reg_expr', latex: 'y_1\\sim mx_1+b' },
              { id: 'line_final', latex: 'y=2x+1', color: '#10b981' }
            ], "Bước 3: Hoàn tất");
          }
        }
      ]
    },
    intersection: {
      title: "Kịch bản 3: Bấm Giao Điểm — Tìm Nghiệm Hệ Phương Trình Bậc 2",
      question: "Tìm các nghiệm (x, y) của hệ phương trình: y = x² - 4x + 1 và y = 2x - 4.",
      steps: [
        {
          step: 1,
          name: "Bước 1: Nạp 2 phương trình của hệ vào Desmos",
          desc: "Nhập trực tiếp vế trái và vế phải của 2 hàm số.",
          actionText: "▶️ Nạp 2 Đường Đồ Thị (Bước 1)",
          action: () => {
            injectExpressions([
              { id: 'sys_1', latex: 'y = x^2 - 4x + 1', color: '#a855f7' },
              { id: 'sys_2', latex: 'y = 2x - 4', color: '#f59e0b' }
            ], "Bước 1: Nạp 2 Đường");
          }
        },
        {
          step: 2,
          name: "Bước 2: Quan sát 2 giao điểm trên màn hình",
          desc: "Desmos tự động đánh dấu 2 chấm tròn xám tại vị trí 2 đồ thị cắt nhau.",
          actionText: "▶️ Đánh Dấu Giao Điểm (Bước 2)",
          action: () => {
            injectExpressions([
              { id: 'sys_1', latex: 'y = x^2 - 4x + 1', color: '#a855f7' },
              { id: 'sys_2', latex: 'y = 2x - 4', color: '#f59e0b' },
              { id: 'pt_1', latex: '(1, -2)', color: '#10b981' },
              { id: 'pt_2', latex: '(5, 6)', color: '#10b981' }
            ], "Bước 2: Hiện Giao Điểm");
          }
        },
        {
          step: 3,
          name: "Bước 3: Nhấp chuột đọc ngay nghiệm (1, -2) và (5, 6)",
          desc: "Nghiệm của hệ là x = 1, y = -2 hoặc x = 5, y = 6. Bỏ qua bước giải Delta tốn 3 phút!",
          actionText: "▶️ Khóa Nghiệm Hoàn Tất (Bước 3)",
          action: () => {
            injectExpressions([
              { id: 'sys_1', latex: 'y = x^2 - 4x + 1', color: '#a855f7' },
              { id: 'sys_2', latex: 'y = 2x - 4', color: '#f59e0b' },
              { id: 'pt_1', latex: '(1, -2)', color: '#10b981' },
              { id: 'pt_2', latex: '(5, 6)', color: '#10b981' }
            ], "Bước 3: Đọc Nghiệm");
          }
        }
      ]
    }
  };

  const handleCopy = (text: string, title: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedItem(text);
      showToast(`Đã copy công thức: ${title}`, 'success');
      setTimeout(() => setCopiedItem(null), 2000);
    }
  };

  const fetchQuestion = async (topic: string, skillId?: string): Promise<PracticeQuestion | null> => {
    try {
      const res = await fetch('/api/generate-practice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleType: 'desmos', topic, skillId })
      });
      if (res.ok) return await res.json();
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const prefetchNext = (topic: string, skillId?: string) => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = { topic, promise: fetchQuestion(topic, skillId) };
  };

  const handleGenerateQuestion = async (topic: string, skillId?: string) => {
    setCurrentTopic(topic);
    if (skillId !== undefined) setCurrentSkillId(skillId);
    const effectiveSkillId = skillId ?? currentSkillId ?? undefined;
    setIsLoading(true);
    setQuestionData(null);
    setLoadError(false);

    const prefetched = prefetchedRef.current;
    prefetchedRef.current = null;
    const data = prefetched && prefetched.topic === topic
      ? await prefetched.promise
      : await fetchQuestion(topic, effectiveSkillId);

    if (data) {
      setQuestionData(data);
    } else {
      setLoadError(true);
      showToast("Lỗi khi sinh câu hỏi. Vui lòng thử lại.", 'error');
    }
    setIsLoading(false);
  };

  const currentScenarioData = trainingScenarios[activeScenario];
  const currentStepData = currentScenarioData.steps[guidedStep - 1];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header Banner */}
      <div className="math-academy-header epic-shake-active" style={{ background: "linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)", padding: "2rem", borderRadius: "1rem" }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-5xl">🧮</div>
            <div>
              <h1 className="text-3xl font-black" style={{ background: "linear-gradient(to right, #c084fc, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                BÍ KÍP HACK DESMOS (API v1.9 NATIVE)
              </h1>
              <p className="text-purple-200">
                1-Click Nạp Biểu Thức Tự Động & Huấn Luyện 3 Bước Bấm Máy 15 Giây — Phá Đảo 800 Toán SAT!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            {isSdkLoaded && !isSdkOffline ? (
              <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-600 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Desmos API v1.9 Native Sẵn Sàng
              </span>
            ) : (
              <span className="px-3 py-1 bg-amber-950 text-amber-300 border border-amber-600 rounded-full text-xs font-bold flex items-center gap-1.5">
                <span>🌐</span> Chế Độ Desmos Iframe Online
              </span>
            )}
          </div>
        </div>
      </div>
      
      {!currentTopic ? (
        <>
          {/* SECTION A: DESMOS NATIVE LAB & HUẤN LUYỆN 3 BƯỚC BẤM MÁY (INTERACTIVE GUIDED HACK) */}
          <div className="bg-[#131b26] border-2 border-purple-600/70 rounded-2xl p-6 shadow-[0_0_25px_rgba(168,85,247,0.15)] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-900/60 pb-4">
              <div>
                <h2 className="text-2xl font-black text-amber-300 flex items-center gap-2">
                  <span>⚡</span> 1-Click Nạp Biểu Thức & Mô Phỏng 3 Bước Bấm Máy (15 Giây)
                </h2>
                <p className="text-gray-300 text-sm mt-1">
                  Chọn kịch bản thực chiến bên dưới để trải nghiệm thuật toán vẽ đồ thị tự động trực tiếp trên Desmos Native!
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearCalculator}
                  className="px-3 py-1.5 bg-[#1b2533] hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-bold border border-gray-600 transition-colors flex items-center gap-1"
                >
                  <span>🧹</span> Xóa Trắng Bảng
                </button>
              </div>
            </div>

            {/* Split Screen: Desmos Native (Trái) & 3-Step Guided Controller (Phải) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Cột Trái: Desmos Native SDK v1.9 (8 cols) */}
              <div className="lg:col-span-7 bg-[#0e1117] border border-purple-800/80 rounded-xl overflow-hidden flex flex-col h-[520px] shadow-xl">
                <div className="bg-[#1b2533] px-4 py-2 border-b border-gray-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-purple-300 font-bold">
                    <span>📐</span>
                    <span>MÁY TÍNH DESMOS OFFICIAL SAT BLUEBOOK</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => injectExpressions([
                        { id: 'demo_line', latex: 'y = 2x + 1' },
                        { id: 'demo_parab', latex: 'y = -x^2 + 4' }
                      ], "Hệ mẫu thử nghiệm")}
                      className="px-2 py-0.5 bg-purple-900/70 hover:bg-purple-800 text-purple-200 rounded border border-purple-700 font-mono text-[11px]"
                    >
                      🚀 Vẽ Thử
                    </button>
                  </div>
                </div>

                {/* Container render Desmos API v1.9 Native hoặc fallback Iframe */}
                <div className="flex-1 w-full relative bg-white">
                  {!isSdkOffline ? (
                    <div ref={attachContainerRef} className="w-full h-full" />
                  ) : (
                    <iframe
                      src="https://www.desmos.com/calculator?lang=vi"
                      className="w-full h-full border-0"
                      title="Desmos Graphing Calculator Fallback"
                    />
                  )}
                </div>
              </div>

              {/* Cột Phải: Bảng Điều Khiển Huấn Luyện 3 Bước (5 cols) */}
              <div className="lg:col-span-5 bg-[#1a2332] border border-[#334155] rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-lg">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                      🎯 Chọn Kịch Bản Huấn Luyện:
                    </span>
                    <span className="text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                      15s SAT Hack
                    </span>
                  </div>

                  {/* Tab chọn kịch bản */}
                  <div className="grid grid-cols-3 gap-1.5 mb-4">
                    {[
                      { id: 'slider', label: '🎚️ Slider k' },
                      { id: 'regression', label: '📊 Hồi quy ~' },
                      { id: 'intersection', label: '📍 Giao điểm' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveScenario(tab.id as 'slider' | 'regression' | 'intersection');
                          setGuidedStep(1);
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-bold border transition-all text-center ${
                          activeScenario === tab.id
                            ? 'bg-purple-900/80 border-purple-500 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                            : 'bg-[#0e1117] border-gray-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Câu hỏi mô phỏng đề thi */}
                  <div className="bg-[#0e1117] p-3.5 rounded-lg border border-gray-800 mb-4">
                    <div className="text-xs font-bold text-amber-300 mb-1">{currentScenarioData.title}</div>
                    <p className="text-xs text-gray-300 leading-relaxed font-serif">{currentScenarioData.question}</p>
                  </div>

                  {/* 3 Bước Bấm Máy */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Tiến trình 3 bước:</span>
                      <span className="font-bold text-purple-300">Bước {guidedStep}/3</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {[1, 2, 3].map((stepNum) => (
                        <div
                          key={stepNum}
                          onClick={() => setGuidedStep(stepNum as 1 | 2 | 3)}
                          className={`h-2 rounded-full cursor-pointer transition-all ${
                            guidedStep >= stepNum ? 'bg-gradient-to-r from-purple-500 to-amber-400' : 'bg-gray-800'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="bg-[#0e1117] p-3.5 rounded-xl border-2 border-purple-500/60 relative overflow-hidden">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                          {guidedStep}
                        </span>
                        <h4 className="text-sm font-bold text-white">{currentStepData.name}</h4>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed mb-3">{currentStepData.desc}</p>

                      <button
                        onClick={currentStepData.action}
                        className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-98"
                      >
                        <span>🚀</span>
                        <span>{currentStepData.actionText}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Nút điều hướng bước */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                  <button
                    disabled={guidedStep === 1}
                    onClick={() => setGuidedStep(p => Math.max(1, p - 1) as 1 | 2 | 3)}
                    className="px-3 py-1.5 bg-[#0e1117] hover:bg-gray-800 text-gray-400 disabled:opacity-30 rounded-lg text-xs font-bold border border-gray-700 transition-colors"
                  >
                    ⬅️ Bước trước
                  </button>
                  <button
                    onClick={() => {
                      if (guidedStep < 3) {
                        const next = (guidedStep + 1) as 1 | 2 | 3;
                        setGuidedStep(next);
                        currentScenarioData.steps[next - 1].action();
                      } else {
                        showToast("🎉 Chúc mừng bạn đã nắm trọn tuyệt chiêu 15s!", 'success');
                      }
                    }}
                    className="px-4 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-[#78350f] rounded-lg text-xs font-bold transition-all shadow"
                  >
                    {guidedStep === 3 ? '🎉 Hoàn Tất Hack' : 'Bước Kế Tiếp ➔'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION B: KHO 10 BÍ KÍP DESMOS THỰC CHIẾN (1-CLICK NẠP TỰ ĐỘNG) */}
          <div className="bg-[#131b26] border border-[#3b4252] rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#262730] pb-4">
              <div>
                <h3 className="text-xl font-bold text-amber-300 flex items-center gap-2">
                  <span>📋</span> Kho 10 Bí Kíp Desmos Thực Chiến (1-Click Nạp Vào Máy Tính)
                </h3>
                <p className="text-gray-300 text-sm mt-1">
                  Nhấn vào nút <span className="text-amber-300 font-bold">"🚀 Nạp Tự Động"</span> để vẽ đồ thị ngay lập tức lên màn hình máy tính Desmos phía trên!
                </p>
              </div>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold self-start">
                10 Chiêu Thức 800+ SAT
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {desmosFormulas.map((formula, idx) => {
                const isCopied = copiedItem === formula.syntax;
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-[#262730] bg-[#0e1117] hover:border-purple-500/80 hover:bg-[#161c28] transition-all flex flex-col justify-between group shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-200 group-hover:text-purple-300 transition-colors">
                          {formula.title}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-purple-950/80 text-purple-300 border border-purple-800">
                          {formula.category}
                        </span>
                      </div>
                      <code className="text-sm font-mono text-amber-300 bg-[#1b2533] px-3 py-2 rounded border border-[#334155] block overflow-x-auto select-all mb-2">
                        {formula.syntax}
                      </code>
                      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{formula.desc}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                      <button
                        onClick={() => {
                          if (formula.multiExpr) {
                            injectExpressions(formula.multiExpr, formula.title);
                          } else {
                            injectExpressions([{ id: `expr_${idx}`, latex: formula.latex }], formula.title);
                          }
                        }}
                        className="flex-1 py-1.5 px-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
                        title="Vẽ ngay biểu thức này vào máy tính Desmos"
                      >
                        <span>🚀 Nạp Tự Động Vào Máy Tính</span>
                      </button>
                      <button
                        onClick={() => handleCopy(formula.syntax, formula.title)}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                          isCopied 
                            ? 'bg-emerald-600 text-white border-emerald-500' 
                            : 'bg-[#1b2533] hover:bg-gray-700 text-gray-300 border-gray-600'
                        }`}
                        title="Copy cú pháp"
                      >
                        {isCopied ? '✅ Đã Chép' : '📋 Chép'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Phím tắt thao tác nhanh */}
            <div className="pt-4 border-t border-gray-800">
              <h4 className="text-xs font-bold text-purple-300 mb-3 uppercase tracking-wider">
                ⌨️ Phím tắt thao tác nhanh trên bàn phím:
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {desmosKeyTips.map((tip, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handleCopy(tip.key, tip.name)}
                    className="bg-[#0e1117] border border-[#262730] hover:border-purple-500 p-2 rounded-lg text-center cursor-pointer transition-all hover:scale-105"
                    title={`Click để copy phím ${tip.key}`}
                  >
                    <kbd className="inline-block px-2 py-0.5 bg-[#1b2533] border border-gray-700 rounded text-amber-400 font-mono font-bold text-xs">
                      {tip.key}
                    </kbd>
                    <div className="text-xs font-bold text-gray-200 mt-1">{tip.name}</div>
                    <div className="text-[10px] text-gray-400">{tip.usage}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION C: 6 DANH MỤC CHỦ ĐỀ LUYỆN TẬP */}
          <div className="bg-[#1b2533] border border-[#a855f7] rounded-xl p-6 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
            <h2 className="text-2xl font-bold text-[#c084fc] mb-2 flex items-center gap-2">
              <span>🎯</span> Lựa Chọn Chủ Đề Luyện Tập Hack Desmos
            </h2>
            <p className="text-[#e2e8f0] mb-6">Nhấn vào chủ đề bên dưới để thi triển nhãn thuật đồ thị phá giải các câu Toán khó nhất:</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => handleGenerateQuestion(cat.name, cat.skillId)}
                  className="bg-[#0e1117] border border-[#262730] p-5 rounded-xl hover:border-[#a855f7] hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] cursor-pointer transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{cat.icon}</span>
                      <span className="text-xs bg-purple-950/80 text-purple-300 border border-purple-800 px-2 py-0.5 rounded font-mono">
                        {cat.skillId.split('.')[1] || 'desmos'}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2 group-hover:text-[#c084fc] transition-colors">{cat.name}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{cat.desc}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-800 text-xs font-semibold text-purple-400 flex items-center justify-between">
                    <span>Luyện ngay với máy tính bên cạnh</span>
                    <span className="group-hover:translate-x-1 transition-transform">➔</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* MÀN HÌNH LUYỆN TẬP BÀI THI KÈM MÁY TÍNH DESMOS SONG SONG */}
          <div className="flex justify-between items-center bg-[#1b2533] p-4 rounded-xl border border-[#262730]">
            <div>
              <span className="text-gray-400 text-sm">Chủ đề Desmos hiện tại:</span>
              <h2 className="text-xl font-bold text-[#c084fc]">{currentTopic}</h2>
            </div>
            <button
              onClick={() => { setCurrentTopic(null); setCurrentSkillId(null); setQuestionData(null); }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors flex items-center gap-1.5"
            >
              <span>⬅️</span>
              <span>Quay lại danh mục</span>
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
            {/* Khung máy tính Desmos song song bên trái */}
            <div className="bg-[#1b2533] p-2 rounded-xl border border-[#4c1d95] shadow-lg flex flex-col h-[650px]">
              <div className="text-white font-bold px-3 py-2 mb-2 flex items-center justify-between border-b border-[#334155]">
                <div className="flex items-center gap-2">
                  <span>🧮 Màn Hình Máy Tính Desmos</span>
                  <span className="text-xs bg-[#4c1d95] px-2 py-0.5 rounded text-[#e2e8f0]">SAT Official API v1.9</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => injectExpressions([
                      { id: 'p_reg_x', latex: 'x_1=[1,2,3]' },
                      { id: 'p_reg_y', latex: 'y_1=[5,7,9]' },
                      { id: 'p_reg', latex: 'y_1\\sim mx_1+b' }
                    ], "Hồi quy tuyến tính")}
                    className="text-xs bg-purple-900/80 hover:bg-purple-800 text-purple-200 px-2 py-1 rounded border border-purple-700 transition-colors"
                    title="Nạp nhanh cú pháp hồi quy"
                  >
                    ⚡ y₁ ~ mx₁ + b
                  </button>
                  <button 
                    onClick={() => injectExpressions([
                      { id: 'p_slider_k', latex: 'y=2x+k' },
                      { id: 'p_k_val', latex: 'k=3', sliderBounds: { min: -10, max: 10, step: 0.1 } }
                    ], "Thanh trượt k")}
                    className="text-xs bg-purple-900/80 hover:bg-purple-800 text-purple-200 px-2 py-1 rounded border border-purple-700 transition-colors"
                    title="Nạp thanh trượt k"
                  >
                    🎚️ Slider k
                  </button>
                  <button 
                    onClick={handleClearCalculator}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-600 transition-colors"
                    title="Xóa trắng bảng"
                  >
                    🧹 Xóa
                  </button>
                </div>
              </div>

              {/* Render Native Desmos hoặc Fallback Iframe */}
              <div className="flex-1 w-full rounded-lg overflow-hidden bg-white relative">
                {!isSdkOffline ? (
                  <div ref={attachContainerRef} className="w-full h-full" />
                ) : (
                  <iframe 
                    src="https://www.desmos.com/calculator?lang=vi" 
                    className="w-full h-full border-0 bg-white"
                    title="Desmos Graphing Calculator"
                  />
                )}
              </div>
            </div>

            {/* Khung bài tập thực hành bên phải */}
            <div className="flex flex-col h-[650px] overflow-y-auto pr-2 custom-scrollbar">
              {(isLoading || questionData) && (
                <CorePracticeUI
                  questionData={questionData as PracticeQuestion}
                  isLoading={isLoading}
                  onNext={() => handleGenerateQuestion(currentTopic, currentSkillId ?? undefined)}
                  onSubmitted={() => prefetchNext(currentTopic, currentSkillId ?? undefined)}
                />
              )}

              {loadError && !isLoading && !questionData && (
                <div className="bg-[#1b2533] p-8 rounded-xl border border-red-500/40 flex flex-col items-center text-center">
                  <div className="text-5xl mb-3">⚠️</div>
                  <h3 className="text-lg font-bold text-white mb-1">Không sinh được câu hỏi</h3>
                  <p className="text-gray-400 text-sm mb-4">Gia sư AI tạm thời chưa phản hồi. Kiểm tra kết nối rồi thử lại.</p>
                  <button
                    onClick={() => handleGenerateQuestion(currentTopic, currentSkillId ?? undefined)}
                    className="text-sm font-bold bg-gradient-to-r from-yellow-300 to-amber-500 text-[#78350f] px-5 py-2 rounded-lg hover:from-yellow-200 hover:to-amber-400"
                  >
                    🔄 Thử lại
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
