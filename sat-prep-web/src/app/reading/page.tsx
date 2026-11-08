'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useGamification } from '@/context/GamificationContext';

// ==========================================
// TYPES & DATA STRUCTURES
// ==========================================
export interface HarvestWord {
  id: string;
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  meaning: string;
  contextSentence: string;
  satTip: string;
}

export interface ReadingModule {
  id: string;
  category: string;
  title: string;
  targetScore: string;
  tag: string;
  icon: string;
  difficulty: 'Hard' | 'Medium' | 'Expert';
  estimatedTime: string;
  strategySummary: {
    coreRule: string;
    steps: string[];
    commonTrap: string;
  };
  passage: {
    title: string;
    source?: string;
    type: 'single' | 'paired' | 'bullet_notes' | 'grammar';
    text1?: string;
    text2?: string;
    standardText?: string;
    bulletNotes?: string[];
    // Syntax X-Ray structured annotations
    xrayAnalysis: {
      sentenceSnippet: string;
      subject: string;
      verb: string;
      objectOrComplement: string;
      distractorClause: string;
      takeaway: string;
    };
  };
  harvestableWords: HarvestWord[];
  question: {
    prompt: string;
    options: {
      label: string;
      text: string;
      isCorrect: boolean;
      rationale: string;
    }[];
  };
}

// ==========================================
// 4 CHUYÊN ĐỀ ĐẶC TRỊ 730+ DIGITAL SAT
// ==========================================
const READING_MODULES: ReadingModule[] = [
  // ── CHUYÊN ĐỀ 1: CROSS-TEXT CONNECTIONS ──
  {
    id: 'cross-text',
    category: 'Cross-Text Connections',
    title: 'So Chiếu Hai Góc Nhìn (Text 1 vs Text 2)',
    targetScore: '750 - 800 Band',
    tag: 'Độ khó cao nhất SAT Reading',
    icon: '⚔️',
    difficulty: 'Expert',
    estimatedTime: '60 giây',
    strategySummary: {
      coreRule: 'Đọc Text 2 trước! Nhận diện ngay lập trường của Tác giả 2: Phản bác (refute), Mở rộng (extend), hay Đặt điều kiện giới hạn (qualify) đối với Tác giả 1.',
      steps: [
        'Bước 1: Quét nhanh Text 2 để tóm lược Lập luận trung tâm (Main Claim).',
        'Bước 2: Tìm Điểm giao thoa (Focal Intersection) được câu hỏi nhắc tới trong Text 1.',
        'Bước 3: Loại bỏ đáp án phiến diện (cực đoan hóa quan điểm) hoặc đảo ngược chiều quan hệ.'
      ],
      commonTrap: 'Bẫy "Extreme Distortion": Đáp án biến sự nghi ngờ phương pháp của Tác giả 2 thành sự phủ định hoàn toàn mọi phát hiện của Tác giả 1.'
    },
    passage: {
      title: 'Tranh Luận Cổ Sinh Vật Học: Đại Tuyệt Chủng Cuối Kỷ Phấn Trắng',
      type: 'paired',
      text1: 'Paleontologist Marcus Vance contends that the sudden mass extinction of non-avian dinosaurs was exclusively catalyzed by the catastrophic Chicxulub asteroid impact. Vance points to iridium-rich sediment layers spanning globally across the Cretaceous-Paleogene boundary, arguing that atmospheric sulfur and widespread soot plunged global temperatures rapidly, thereby suffocating photosynthetic food chains within months.',
      text2: 'Geochemist Elena Rostova, while conceding that the Chicxulub impact dealt a devastating shock, maintains that long-term environmental instability had already initiated biotic decline. Rostova analyzes the massive Deccan Traps volcanic outpourings in western India, which released volatile greenhouse gases over hundreds of thousands of years. She contends that these protracted emissions caused volatile climatic swings and marine acidification, rendering ecosystems fragile long before the asteroid struck.',
      xrayAnalysis: {
        sentenceSnippet: 'Geochemist Elena Rostova, while conceding that the Chicxulub impact dealt a devastating shock, maintains that long-term environmental instability had already initiated biotic decline.',
        subject: 'Geochemist Elena Rostova',
        verb: 'maintains',
        objectOrComplement: 'that long-term environmental instability had already initiated biotic decline.',
        distractorClause: 'while conceding that the Chicxulub impact dealt a devastating shock (Mệnh đề nhượng bộ phụ - không làm đổi động từ chính)',
        takeaway: 'Chủ ngữ và Động từ chính bị phân tách bởi mệnh đề nhượng bộ. Rostova thừa nhận va chạm thiên thạch nhưng lập trường cốt lõi là sự bất ổn định môi trường dài hạn do núi lửa đã xảy ra trước.'
      }
    },
    harvestableWords: [
      {
        id: 'cross-w1',
        word: 'corroborate',
        partOfSpeech: 'verb',
        pronunciation: '/kəˈrɒbəreɪt/',
        meaning: 'Chứng thực, gia cố bằng bằng chứng mới hoặc dữ liệu độc lập',
        contextSentence: 'New geologic core samples fail to corroborate the hypothesis of a solitary catastrophic event.',
        satTip: 'Thường xuất hiện trong câu hỏi Evidence; mang nghĩa tích cực (củng cố luận điểm).'
      },
      {
        id: 'cross-w2',
        word: 'ameliorate',
        partOfSpeech: 'verb',
        pronunciation: '/əˈmiːliəreɪt/',
        meaning: 'Làm dịu bớt, cải thiện, giảm thiểu tính nghiêm trọng của khủng hoảng',
        contextSentence: 'Oceanic buffering systems were incapable of ameliorating rapid atmospheric acidification.',
        satTip: 'Từ vựng vàng band 750+. Tránh nhầm với "deteriorate" (làm xấu đi).'
      },
      {
        id: 'cross-w3',
        word: 'equivocal',
        partOfSpeech: 'adjective',
        pronunciation: '/ɪˈkwɪvəkl/',
        meaning: 'Mập mờ, nước đôi, chưa ngã ngũ, có thể hiểu theo nhiều cách',
        contextSentence: 'Preliminary fossil strata provide only equivocal indications regarding the exact timeline.',
        satTip: 'Trong SAT Tone & Evidence: nếu tác giả chưa chắc chắn, bằng chứng là "equivocal".'
      },
      {
        id: 'cross-w4',
        word: 'plausible',
        partOfSpeech: 'adjective',
        pronunciation: '/ˈplɔːzəbl/',
        meaning: 'Hợp lý, đáng tin cậy, có căn cứ khoa học thỏa đáng',
        contextSentence: 'Rostova presents a plausible alternative mechanism grounded in geochemical stratigraphy.',
        satTip: 'Thường dùng để mô tả giả thuyết khoa học có sức thuyết phục cao.'
      }
    ],
    question: {
      prompt: 'Dựa trên hai đoạn văn, Tác giả 2 (Rostova) nhiều khả năng sẽ phản hồi như thế nào trước luận điểm của Vance trong Text 1?',
      options: [
        {
          label: 'A',
          text: 'Phủ nhận hoàn toàn việc tiểu hành tinh Chicxulub gây ra bất kỳ tác động sinh học nào lên hệ sinh thái kỷ Phấn Trắng.',
          isCorrect: false,
          rationale: 'Sai vì bẫy cực đoan: Rostova thừa nhận ("conceding") vụ va chạm là cú sốc tàn khốc, chứ không hề phủ nhận.'
        },
        {
          label: 'B',
          text: 'Lập luận rằng tác động của tiểu hành tinh là cú đánh kết liễu vào một sinh quyển vốn đã suy yếu trầm trọng do hoạt động núi lửa kéo dài.',
          isCorrect: true,
          rationale: 'Chính xác! Rostova cho rằng núi lửa Deccan Traps đã gây bất ổn trước, khiến sinh quyển trở nên mong manh trước khi thiên thạch đâm xuống.'
        },
        {
          label: 'C',
          text: 'Khẳng định rằng lượng khí lưu huỳnh từ bụi thiên thạch thực chất đã giúp trung hòa độ axit do núi lửa gây ra.',
          isCorrect: false,
          rationale: 'Sai vì bịa đặt thông tin (Fabricated Detail) không có trong bài đọc.'
        },
        {
          label: 'D',
          text: 'Đồng ý với Vance rằng thời điểm tuyệt chủng diễn ra đột ngột chỉ trong vài tháng mà không có dấu hiệu suy thoái trước đó.',
          isCorrect: false,
          rationale: 'Sai vì mâu thuẫn trực tiếp với Text 2 (Rostova nhấn mạnh suy thoái lâu dài hàng trăm nghìn năm).'
        }
      ]
    }
  },

  // ── CHUYÊN ĐỀ 2: QUANTITATIVE EVIDENCE ──
  {
    id: 'quantitative-evidence',
    category: 'Quantitative Evidence',
    title: 'Đọc Biểu Đồ & Dữ Liệu Khoa Học Trong 45 Giây',
    targetScore: '730 - 780 Band',
    tag: 'Không cần dịch cả bài',
    icon: '📊',
    difficulty: 'Hard',
    estimatedTime: '45 giây',
    strategySummary: {
      coreRule: 'Nguyên tắc vàng: Đồ thị không nói dối, chỉ có đáp án gài bẫy suy diễn! Chỉ cần 3 điểm chạm: Tên trục Y, Tên trục X, và Câu chốt giả thuyết ở cuối đoạn.',
      steps: [
        'Bước 1: Đọc nhãn trục X (Biến độc lập) và trục Y (Biến phụ thuộc) cùng đơn vị đo lường.',
        'Bước 2: Tìm câu cuối cùng của bài đọc (Hypothesis cần chứng minh hoặc bác bỏ).',
        'Bước 3: Đối chiếu số liệu từng đáp án; gạch bỏ ngay đáp án đưa ra xu hướng ngược hoặc vượt quá bảng số liệu.'
      ],
      commonTrap: 'Bẫy "Out of Bounds Inference": Đáp án suy đoán nguyên nhân tâm lý/sinh thái nhưng bảng số liệu chỉ thuần túy đo lường phần trăm nhiệt độ.'
    },
    passage: {
      title: 'Khảo Sát Khả Năng Chịu Nhiệt Của Tán Cây Rừng Ôn Đới',
      type: 'single',
      standardText: 'Ecologists studying forest resilience subjected four temperate tree species to simulated heatwaves. They recorded canopy transpiration rates (mmol/m²·s) alongside stomatal closure percentages under prolonged heat. The researchers hypothesized that species capable of sustaining elevated transpiration would mitigate thermal damage to leaf tissues more effectively than species that promptly underwent complete stomatal closure.',
      xrayAnalysis: {
        sentenceSnippet: 'The researchers hypothesized that species capable of sustaining elevated transpiration would mitigate thermal damage to leaf tissues more effectively than species that promptly underwent complete stomatal closure.',
        subject: 'The researchers [S]',
        verb: 'hypothesized [V]',
        objectOrComplement: 'that species capable of sustaining elevated transpiration would mitigate thermal damage [O]',
        distractorClause: 'capable of sustaining elevated transpiration / than species that promptly underwent complete stomatal closure (Cụm phân từ & mệnh đề so sánh)',
        takeaway: 'Lõi thông điệp: Nhà nghiên cứu đưa ra giả thuyết rằng loài thoát hơi nước cao sẽ giảm nhiệt tốt hơn loài đóng khí khổng sớm.'
      }
    },
    harvestableWords: [
      {
        id: 'quant-w1',
        word: 'disparate',
        partOfSpeech: 'adjective',
        pronunciation: '/ˈdɪspərət/',
        meaning: 'Khác biệt căn bản, không đồng nhất, hoàn toàn dị biệt',
        contextSentence: 'The experimental trials produced disparate photosynthetic responses across canopy heights.',
        satTip: 'Thường miêu tả kết quả hoặc dữ liệu không đồng nhất giữa các nhóm thử nghiệm.'
      },
      {
        id: 'quant-w2',
        word: 'bolster',
        partOfSpeech: 'verb',
        pronunciation: '/ˈboʊlstər/',
        meaning: 'Củng cố, nâng đỡ, gia tăng độ tin cậy của luận điểm',
        contextSentence: 'Observed stomatal conductance values bolster the premise of adaptive thermal resilience.',
        satTip: 'Từ vựng quan trọng bậc nhất dạng câu hỏi "Which choice most effectively supports/bolsters the claim?".'
      },
      {
        id: 'quant-w3',
        word: 'anomalous',
        partOfSpeech: 'adjective',
        pronunciation: '/əˈnɑːmələs/',
        meaning: 'Bất thường, dị thường, lệch chuẩn so với quy luật chung',
        contextSentence: 'One oak specimen exhibited an anomalous resistance profile under excessive vapor pressure.',
        satTip: 'Dùng khi xuất hiện số liệu ngoại lai (outlier) trên biểu đồ.'
      },
      {
        id: 'quant-w4',
        word: 'undermine',
        partOfSpeech: 'verb',
        pronunciation: '/ˌʌndərˈmaɪn/',
        meaning: 'Làm suy yếu ngấm ngầm, lung lay nền tảng của một lý thuyết',
        contextSentence: 'Excessive foliage desiccation threatened to undermine their initial resilience model.',
        satTip: 'Từ trái nghĩa trực tiếp với "bolster" / "corroborate".'
      }
    ],
    question: {
      prompt: 'Nếu bảng số liệu cho thấy Loài Pinus taeda duy trì tốc độ thoát hơi nước 4.8 mmol/m²·s và chỉ bị cháy lá 5%, trong khi Quercus rubra giảm thoát hơi nước xuống 0.9 mmol/m²·s và bị cháy lá 34%, phát hiện nào sau đây củng cố mạnh mẽ nhất (bolsters) giả thuyết của các nhà nghiên cứu?',
      options: [
        {
          label: 'A',
          text: 'Cả hai loài cây đều có mức tiêu hao nước tổng thể bằng nhau bất kể điều kiện thời tiết.',
          isCorrect: false,
          rationale: 'Sai vì số liệu thoát hơi nước khác nhau rõ rệt (4.8 vs 0.9), không thể coi là bằng nhau.'
        },
        {
          label: 'B',
          text: 'Khả năng duy trì thoát hơi nước liên tục ở Pinus taeda tạo cơ chế làm mát bay hơi, giúp bảo vệ mô lá khỏi tổn thương nhiệt so với Quercus rubra.',
          isCorrect: true,
          rationale: 'Chính xác! Đối chiếu khớp 100% với giả thuyết (thoát hơi nước cao -> giảm thiểu tổn hại nhiệt).'
        },
        {
          label: 'C',
          text: 'Quercus rubra chủ động rụng lá nhằm dự trữ chất dinh dưỡng cho chu kỳ mùa đông tiếp theo.',
          isCorrect: false,
          rationale: 'Sai vì đưa ra giả định ngoài lề (Out of Scope) về mùa đông không có trong nghiên cứu đợt nắng nóng.'
        },
        {
          label: 'D',
          text: 'Đóng khí khổng sớm là chiến lược sinh tồn tối ưu nhất cho mọi loài thực vật trong rừng ôn đới.',
          isCorrect: false,
          rationale: 'Sai vì đi ngược lại trực tiếp với dữ liệu (loài đóng sớm bị tổn thương lá nặng tới 34%).'
        }
      ]
    }
  },

  // ── CHUYÊN ĐỀ 3: RHETORICAL SYNTHESIS ──
  {
    id: 'rhetorical-synthesis',
    category: 'Rhetorical Synthesis',
    title: 'Xử Lý Câu Bullet Notes Trong 20 Giây (Mẹo Đọc Goal)',
    targetScore: '740 - 800 Band',
    tag: 'Tối ưu hóa thời gian thi',
    icon: '📝',
    difficulty: 'Medium',
    estimatedTime: '20 giây',
    strategySummary: {
      coreRule: 'TUYỆT ĐỐI KHÔNG ĐỌC HẾT CÁC GẠCH ĐẦU DÒNG! Đọc ngay câu hỏi ở cuối: Xác định MỤC TIÊU CỐT LÕI (Goal: So sánh sự khác biệt? Giới thiệu dự án? Nêu bật phương pháp?). Đáp án ĐÚNG CHỈ CẦN hoàn thành đúng mục tiêu đó.',
      steps: [
        'Bước 1: Bỏ qua toàn bộ Bullet Notes, đọc ngay câu lệnh đề bài (Prompt Goal).',
        'Bước 2: Gạch chân từ khóa mục tiêu: ví dụ "emphasize a contrast" hoặc "introduce to an audience unfamiliar with...".',
        'Bước 3: Quét 4 đáp án: Đáp án nào vừa chứa từ khóa so sánh (nhưng/ngược lại) vừa nêu đúng 2 chủ thể thì chọn ngay!'
      ],
      commonTrap: 'Bẫy "Factually True but Goal Irrelevant": Đáp án chứa thông tin hoàn toàn đúng sự thật từ bullet notes nhưng KHÔNG hề đáp ứng mục tiêu đề bài yêu cầu.'
    },
    passage: {
      title: 'Ghi Chú Nghiên Cứu Về Hai Kính Viễn Vọng Không Gian',
      type: 'bullet_notes',
      bulletNotes: [
        'Kính viễn vọng không gian Hubble được phóng lên quỹ đạo Trái Đất tầm thấp (LEO) vào năm 1990.',
        'Hubble chủ yếu quan sát vũ trụ trong phổ ánh sáng khả kiến (optical) và tử ngoại (UV).',
        'Kính viễn vọng không gian James Webb (JWST) được phóng vào tháng 12 năm 2021 lên điểm Lagrange L2.',
        'Điểm L2 cách Trái Đất xấp xỉ 1,5 triệu km, cách xa bức xạ nhiệt từ hành tinh.',
        'JWST được trang bị gương beryllium mạ vàng đường kính 6,5 mét, chuyên thu nhận bức xạ hồng ngoại (infrared).',
        'Bức xạ hồng ngoại cho phép JWST quan sát xuyên qua bụi liên sao để thấy những thiên hà sơ khai nhất.'
      ],
      xrayAnalysis: {
        sentenceSnippet: 'While the Hubble Space Telescope primarily observes ultraviolet and optical wavelengths from low Earth orbit, the James Webb Space Telescope operates at the distant L2 point to detect infrared light.',
        subject: 'the James Webb Space Telescope [S2] / the Hubble Space Telescope [S1]',
        verb: 'operates [V2] / observes [V1]',
        objectOrComplement: 'at the distant L2 point to detect infrared light [O2]',
        distractorClause: 'While the Hubble... low Earth orbit (Mệnh đề phụ chỉ sự tương phản)',
        takeaway: 'Cấu trúc tương phản đối xứng hoàn hảo [While X does A, Y does B]. Hoàn thành 100% mục tiêu "so sánh sự khác biệt về quỹ đạo và phổ sóng".'
      }
    },
    harvestableWords: [
      {
        id: 'rhet-w1',
        word: 'preclude',
        partOfSpeech: 'verb',
        pronunciation: '/prɪˈkluːd/',
        meaning: 'Ngăn chặn từ trước, loại trừ khả năng xảy ra',
        contextSentence: 'Operating at L2 precludes interference from terrestrial heat signatures.',
        satTip: 'Thường dùng để giải thích vì sao một phương án công nghệ hoặc khoa học loại bỏ được lỗi.'
      },
      {
        id: 'rhet-w2',
        word: 'delineate',
        partOfSpeech: 'verb',
        pronunciation: '/dɪˈlɪnieɪt/',
        meaning: 'Phác thảo ranh giới, mô tả rành mạch từng chi tiết cụ thể',
        contextSentence: 'The technical notes clearly delineate the spectral boundaries of both instruments.',
        satTip: 'Rất hay gặp trong câu hỏi mục tiêu phân định hai đối tượng.'
      },
      {
        id: 'rhet-w3',
        word: 'divergence',
        partOfSpeech: 'noun',
        pronunciation: '/daɪˈvɜːrdʒəns/',
        meaning: 'Sự phân kỳ, phân nhánh, độ lệch pha, khác biệt hướng đi',
        contextSentence: 'Their core scientific divergence centers on observational waveband specializations.',
        satTip: 'Từ vựng đắt giá để chỉ sự khác biệt có tính hệ thống.'
      }
    ],
    question: {
      prompt: 'Học sinh muốn nhấn mạnh sự KHÁC BIỆT CHÍNH về phạm vi bước sóng quan sát giữa Hubble và JWST. Lựa chọn nào sử dụng thông tin từ các ghi chú để hoàn thành mục tiêu này một cách hiệu quả nhất?',
      options: [
        {
          label: 'A',
          text: 'Được phóng vào năm 1990 và 2021, cả Hubble và JWST đều là những đài quan sát không gian đột phá của nhân loại.',
          isCorrect: false,
          rationale: 'Sai vì chỉ nêu điểm tương đồng chung chung (cả hai đều đột phá), không hề chỉ ra sự khác biệt về bước sóng.'
        },
        {
          label: 'B',
          text: 'Trong khi Hubble quan sát vũ trụ chủ yếu ở bước sóng khả kiến và tử ngoại, JWST được thiết kế đặc biệt để bắt bức xạ hồng ngoại xuyên qua bụi vũ trụ.',
          isCorrect: true,
          rationale: 'Chính xác 100%! Tập trung trực tiếp vào mục tiêu "sự khác biệt về bước sóng quan sát" với từ nối tương phản "Trong khi" (While).'
        },
        {
          label: 'C',
          text: 'JWST có gương beryllium mạ vàng rộng 6,5 mét và bay cách Trái Đất 1,5 triệu km tại điểm L2.',
          isCorrect: false,
          rationale: 'Sai bẫy Goal: Câu này chỉ mô tả riêng JWST và kích thước gương/quỹ đạo, hoàn toàn không so sánh bước sóng với Hubble.'
        },
        {
          label: 'D',
          text: 'Bức xạ hồng ngoại cho phép các nhà thiên văn học nhìn thấy các thiên hà đầu tiên sau Vụ Nổ Lớn.',
          isCorrect: false,
          rationale: 'Sai vì câu này chỉ giải thích công dụng của tia hồng ngoại, không hề nhắc tới Hubble.'
        }
      ]
    }
  },

  // ── CHUYÊN ĐỀ 4: STANDARD ENGLISH CONVENTIONS ──
  {
    id: 'grammar-conventions',
    category: 'Standard English Conventions',
    title: 'Ma Trận Dấu Câu & Cấu Trúc Ngữ Pháp (Semicolon, Colon, Em Dash)',
    targetScore: '760 - 800 Band',
    tag: 'Không được mất điểm ngữ pháp',
    icon: '⚖️',
    difficulty: 'Hard',
    estimatedTime: '30 giây',
    strategySummary: {
      coreRule: 'Dấu câu trong SAT là toán học tuyệt đối: Dấu chấm phẩy (;) = Dấu chấm (.). Dấu hai chấm (:) đòi hỏi Mệnh đề độc lập hoàn chỉnh đứng trước. Cặp gạch ngang (— ... —) tương đương cặp dấu phẩy.',
      steps: [
        'Bước 1: Xác định ranh giới giữa các mệnh đề độc lập (Independent Clauses - IC) và mệnh đề phụ thuộc (DC).',
        'Bước 2: Cấm tuyệt đối "Comma Splice" ([IC] , [IC] -> SAI BẬC NHẤT SAT). Nối 2 IC phải dùng [IC; IC] hoặc [IC, and IC].',
        'Bước 3: Dấu hai chấm (:) chỉ được dùng khi phía trước là một câu trọn vẹn đủ S-V-O; phía sau là lời giải thích, mở rộng, hoặc danh sách.'
      ],
      commonTrap: 'Bẫy "Colon Trap": Đặt dấu hai chấm ngay sau động từ chính hoặc giới từ (ví dụ: "The results include: A and B" -> SAI NẶNG TRONG SAT).'
    },
    passage: {
      title: 'Đóng Góp Của Rosalind Franklin Trong Lịch Sử Sinh Học Phân Tử',
      type: 'grammar',
      standardText: 'In 1952, physical chemist Rosalind Franklin captured Photograph 51 using X-ray crystallographic techniques. The crisply diffracted pattern revealed an unmistakable helical architecture _____ it firmly established the structural symmetry later synthesized into the double-helix DNA model.',
      xrayAnalysis: {
        sentenceSnippet: 'The crisply diffracted pattern revealed an unmistakable helical architecture; furthermore, it firmly established the structural symmetry later synthesized into the double-helix DNA model.',
        subject: 'The crisply diffracted pattern [S1] / it [S2]',
        verb: 'revealed [V1] / established [V2]',
        objectOrComplement: 'an unmistakable helical architecture [O1] / the structural symmetry [O2]',
        distractorClause: 'later synthesized into the double-helix DNA model (Cụm phân từ rút gọn bổ nghĩa cho symmetry)',
        takeaway: 'Đây là hai Mệnh đề Độc lập (IC) hoàn chỉnh. Phải dùng dấu chấm phẩy (;) kèm trạng từ liên kết "furthermore,", hoặc dấu chấm. Dùng dấu phẩy đơn thuần sẽ phạm lỗi Comma Splice.'
      }
    },
    harvestableWords: [
      {
        id: 'gram-w1',
        word: 'scrutinize',
        partOfSpeech: 'verb',
        pronunciation: '/ˈskruːtənaɪz/',
        meaning: 'Soi xét kỹ lưỡng, khảo sát cẩn trọng từng chi tiết vi mô',
        contextSentence: 'Historians scrutinize laboratory notebooks to assess original priority claims.',
        satTip: 'Thường gặp trong các văn bản phân tích học thuật và đánh giá dữ liệu thí nghiệm.'
      },
      {
        id: 'gram-w2',
        word: 'tenuous',
        partOfSpeech: 'adjective',
        pronunciation: '/ˈtenjuəs/',
        meaning: 'Mong manh, yếu ớt, ít sức nặng, không đủ cơ sở chứng minh',
        contextSentence: 'Alternative structural interpretations remained tenuous without diffraction metrics.',
        satTip: 'Dùng để chỉ lập luận hoặc liên kết lỏng lẻo, thiếu vững chắc.'
      },
      {
        id: 'gram-w3',
        word: 'unprecedented',
        partOfSpeech: 'adjective',
        pronunciation: '/ʌnˈpresɪdentɪd/',
        meaning: 'Chưa từng có tiền lệ, mang tính lịch sử đột phá',
        contextSentence: 'Photograph 51 yielded unprecedented clarity regarding atomic spatial arrangements.',
        satTip: 'Từ vựng mô tả bước ngoặt cách mạng trong khoa học.'
      }
    ],
    question: {
      prompt: 'Lựa chọn nào hoàn thành câu văn tuân thủ đúng chuẩn mực tiếng Anh viết quy chuẩn (Standard English Conventions)?',
      options: [
        {
          label: 'A',
          text: 'architecture, furthermore, it',
          isCorrect: false,
          rationale: 'Sai vì lỗi nghiêm trọng Comma Splice! "furthermore" là trạng từ liên kết (conjunctive adverb), không thể dùng dấu phẩy đơn thuần để nối hai mệnh đề độc lập.'
        },
        {
          label: 'B',
          text: 'architecture; furthermore, it',
          isCorrect: true,
          rationale: 'Chính xác tuyệt đối! Nối hai Mệnh đề Độc lập bằng dấu chấm phẩy (;), theo sau là trạng từ liên kết "furthermore" và dấu phẩy.'
        },
        {
          label: 'C',
          text: 'architecture: and it',
          isCorrect: false,
          rationale: 'Sai vì không dùng dấu hai chấm (:) đi kèm liên từ "and" theo cách vụng về.'
        },
        {
          label: 'D',
          text: 'architecture, it',
          isCorrect: false,
          rationale: 'Sai vì lỗi Comma Splice kinh điển: hai mệnh đề độc lập bị nối với nhau chỉ bằng duy nhất một dấu phẩy.'
        }
      ]
    }
  }
];

export default function ReadingAcademyPage() {
  const { syncServerEconomy, updateQuestProgress } = useGamification();

  // Active module tab
  const [activeModuleId, setActiveModuleId] = useState<string>('cross-text');

  // Syntax X-Ray global toggle
  const [isXrayEnabled, setIsXrayEnabled] = useState<boolean>(true);

  // Vocab Harvest drawer / modal state
  const [selectedWord, setSelectedWord] = useState<HarvestWord | null>(null);
  const [savedWordsMap, setSavedWordsMap] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Question interaction state
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [rewardClaimed, setRewardClaimed] = useState<boolean>(false);

  // Current active module
  const currentModule = useMemo(() => {
    return READING_MODULES.find(m => m.id === activeModuleId) || READING_MODULES[0];
  }, [activeModuleId]);

  // Reset quiz state when switching module
  useEffect(() => {
    setSelectedOptionIndex(null);
    setIsAnswerSubmitted(false);
    setRewardClaimed(false);
    setSelectedWord(null);
  }, [activeModuleId]);

  // Dọn dẹp toast timer & speech synthesis khi unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Check saved words from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('sat_user_custom_vocab_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const map: Record<string, boolean> = {};
          parsed.forEach((item: { word?: string }) => {
            if (item.word) map[item.word.toLowerCase().trim()] = true;
          });
          setSavedWordsMap(map);
        }
      }
    } catch (e) {
      console.warn("Could not parse saved words:", e);
    }
  }, []);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Text-to-Speech audio pronunciation
  const speakWord = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech error:", err);
    }
  };

  // 1-Click Contextual Vocab Harvest handler
  const handleHarvestWord = async (wordItem: HarvestWord) => {
    try {
      // 1. Gửi POST /api/vocab lên server để Auto-Upsert vào Hộp Leitner 1
      const res = await fetch('/api/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wordId: `harvest-${wordItem.word.toLowerCase()}-${Date.now()}`,
          word: wordItem.word,
          meaning: wordItem.meaning,
          example: wordItem.contextSentence,
          pronunciation: wordItem.pronunciation,
          partOfSpeech: wordItem.partOfSpeech,
          isHarvest: true,
          isRemembered: false // Bắt đầu ở Hộp 1 Leitner
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.economy) syncServerEconomy(data.economy);
      }

      // 2. Cập nhật localStorage 'sat_user_custom_vocab_v1'
      let currentCache: Array<{ id: string; box: number; word: string; meaning: string; example: string }> = [];
      try {
        const cached = localStorage.getItem('sat_user_custom_vocab_v1');
        if (cached) currentCache = JSON.parse(cached);
      } catch (err) {
        console.warn(err);
      }

      const existingIndex = currentCache.findIndex(
        w => w.word.toLowerCase().trim() === wordItem.word.toLowerCase().trim()
      );

      if (existingIndex === -1) {
        currentCache.push({
          id: `custom-harvest-${Date.now()}`,
          box: 1,
          word: wordItem.word,
          meaning: wordItem.meaning,
          example: wordItem.contextSentence
        });
        try {
          localStorage.setItem('sat_user_custom_vocab_v1', JSON.stringify(currentCache));
        } catch (storageErr) {
          console.warn("Could not save harvested word to localStorage:", storageErr);
        }
      }

      // 3. Update local state map
      setSavedWordsMap(prev => ({ ...prev, [wordItem.word.toLowerCase().trim()]: true }));
      updateQuestProgress('vocab', 1);
      showToast(`🌾 Đã hái từ "${wordItem.word}" vào Hộp 1 Leitner SRS thành công!`);
    } catch (error) {
      console.error("Lỗi khi harvest từ vựng:", error);
      showToast(`⚠️ Không thể kết nối server, nhưng đã lưu dự phòng vào trình duyệt.`);
    }
  };

  // Submit Answer & Reward XP/Coins
  const handleSubmitAnswer = (optionIdx: number) => {
    if (isAnswerSubmitted) return;
    const options = currentModule.question.options;
    if (!options || optionIdx < 0 || optionIdx >= options.length) return;
    setSelectedOptionIndex(optionIdx);
    setIsAnswerSubmitted(true);

    const isCorrect = Boolean(options[optionIdx]?.isCorrect);
    if (isCorrect && !rewardClaimed) {
      setRewardClaimed(true);
      showToast(`🎉 Xuất sắc! +15 XP và +10 Xu vào tài khoản vì phá vỡ bẫy SAT.`);
      updateQuestProgress('answer', 1);
    }
  };

  // Render clickable passage text with harvest badges
  const renderInteractivePassage = (text: string) => {
    // Tách từ để gắn highlight cho các từ harvestable
    const wordsList = currentModule.harvestableWords;
    let parts: Array<{ text: string; wordObj?: HarvestWord }> = [{ text }];

    wordsList.forEach(wObj => {
      const regex = new RegExp(`\\b(${wObj.word})\\b`, 'gi');
      const newParts: Array<{ text: string; wordObj?: HarvestWord }> = [];

      parts.forEach(part => {
        if (part.wordObj) {
          newParts.push(part);
          return;
        }

        const splitArr = part.text.split(regex);
        splitArr.forEach(seg => {
          if (seg.toLowerCase() === wObj.word.toLowerCase()) {
            newParts.push({ text: seg, wordObj: wObj });
          } else if (seg) {
            newParts.push({ text: seg });
          }
        });
      });

      parts = newParts;
    });

    return (
      <span className="leading-relaxed">
        {parts.map((p, idx) => {
          if (!p.wordObj) return <span key={idx}>{p.text}</span>;
          const isSaved = savedWordsMap[p.wordObj.word.toLowerCase().trim()];
          return (
            <button
              key={idx}
              onClick={() => setSelectedWord(p.wordObj!)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded font-bold text-xs transition-all cursor-pointer underline decoration-dotted underline-offset-4 ${
                isSaved
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900/80'
                  : 'bg-purple-950/80 text-purple-200 border border-purple-400/60 hover:bg-purple-900 hover:scale-105 shadow-[0_0_10px_rgba(168,85,247,0.3)] animate-pulse'
              }`}
              title="Click để xem giải phẫu nghĩa & hái vào Hộp Leitner"
            >
              <span>{p.text}</span>
              <span className="text-[10px]">{isSaved ? '✅' : '🌾'}</span>
            </button>
          );
        })}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24 text-gray-100 max-w-7xl mx-auto px-2 sm:px-4">
      {/* 🧭 THANH ĐIỀU HƯỚNG LIÊN THÔNG READING & VOCAB */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-[#0e1117] border border-[#262730] rounded-2xl shadow-sm">
        <Link
          href="/vocab"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#1b2533] text-gray-300 hover:text-white hover:bg-[#26354a] transition-all border border-transparent hover:border-purple-500/30"
        >
          <span>🗂️</span> Sổ Từ Leitner SRS
        </Link>
        <Link
          href="/vocabulary"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#1b2533] text-gray-300 hover:text-white hover:bg-[#26354a] transition-all border border-transparent hover:border-teal-500/30"
        >
          <span>🔗</span> Từ Nối & Ngữ Cảnh
        </Link>
        <Link
          href="/reading"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30"
        >
          <span>📖</span> Trung Tâm Đọc Hiểu (730+)
        </Link>
      </div>

      {/* 🚀 EPIC HEADER BANNER */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.15)]" style={{ background: "linear-gradient(135deg, #1e112a 0%, #111827 50%, #0d1b2a 100%)" }}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider">
              <span>🎯</span> Luyện Đề Chuẩn Digital SAT 730 - 800
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              TRUNG TÂM ĐẶC TRỊ READING & WRITING
            </h1>
            <p className="text-sm sm:text-base text-gray-300 max-w-2xl leading-relaxed">
              Bẻ khóa 4 chuyên đề bẫy điểm cao nhất kỳ thi Digital SAT với hai vũ khí độc quyền: <strong className="text-cyan-300 font-bold">🔬 Syntax X-Ray (Giải Phẫu Cấu Trúc S-V-O)</strong> và <strong className="text-purple-300 font-bold">🌾 1-Click Contextual Vocab Harvest</strong>.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1b2533]/80 border border-[#262730] text-xs">
              <span className="text-cyan-400">🔬</span>
              <span>Syntax X-Ray 2.0</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1b2533]/80 border border-[#262730] text-xs">
              <span className="text-purple-400">🌾</span>
              <span>1-Click Hái Vào Leitner SRS</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1b2533]/80 border border-[#262730] text-xs">
              <span className="text-amber-400">⚡</span>
              <span>Chiến Thuật Phản Xạ 20s - 45s</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🔔 FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-amber-950/90 border-2 border-amber-400 text-amber-200 text-sm font-bold shadow-[0_0_25px_rgba(245,158,11,0.4)] flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <span className="text-xl">✨</span>
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-gray-400 hover:text-white px-2">✕</button>
        </div>
      )}

      {/* 📑 4 CHUYÊN ĐỀ TABS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {READING_MODULES.map(mod => {
          const isActive = mod.id === activeModuleId;
          return (
            <button
              key={mod.id}
              onClick={() => setActiveModuleId(mod.id)}
              className={`p-4 rounded-2xl text-left transition-all border flex flex-col justify-between ${
                isActive
                  ? 'bg-gradient-to-br from-[#1b2533] to-[#241d3d] border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-1 ring-amber-400'
                  : 'bg-[#0e1117] border-[#262730] hover:border-gray-500 hover:bg-[#141822]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{mod.icon}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    mod.difficulty === 'Expert'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {mod.estimatedTime}
                  </span>
                </div>
                <h3 className={`font-black text-sm mb-1 line-clamp-1 ${isActive ? 'text-amber-300' : 'text-white'}`}>
                  {mod.category}
                </h3>
                <p className="text-xs text-gray-400 line-clamp-2">
                  {mod.title}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-[#262730] flex items-center justify-between text-[11px] font-mono">
                <span className="text-gray-400">{mod.targetScore}</span>
                <span className={isActive ? 'text-amber-400 font-bold' : 'text-gray-500'}>
                  {isActive ? 'Đang học ▶' : 'Khám phá →'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ⚔️ CHI TIẾT CHUYÊN ĐỀ ĐANG CHỌN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CỘT TRÁI (8 CỘT): CHIẾN THUẬT, BÀI ĐỌC, SYNTAX X-RAY & LUYỆN ĐỀ */}
        <div className="lg:col-span-8 space-y-6">
          {/* CHIẾN THUẬT CỐT LÕI */}
          <div className="bg-[#141824] border border-[#262730] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-amber-400 flex items-center gap-2">
                <span>⚡</span> Bí Kíp Tác Chiến: {currentModule.category}
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {currentModule.tag}
              </span>
            </div>

            <p className="text-sm text-gray-200 bg-[#0e1117] p-3 rounded-xl border border-[#262730] font-medium leading-relaxed">
              <strong className="text-amber-300">Quy tắc vàng:</strong> {currentModule.strategySummary.coreRule}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {currentModule.strategySummary.steps.map((step, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-[#1b2533]/60 border border-[#262730] text-xs text-gray-300">
                  {step}
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-200 flex items-start gap-2">
              <span className="text-red-400 shrink-0 text-sm">⚠️</span>
              <span><strong>Cảnh giác bẫy SAT:</strong> {currentModule.strategySummary.commonTrap}</span>
            </div>
          </div>

          {/* KHUNG ĐOẠN VĂN LUYỆN TẬP VÀ VŨ KHÍ SYNTAX X-RAY */}
          <div className="bg-[#141824] border border-[#262730] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262730]">
              <div>
                <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">Đoạn Văn Luyện Tập Thực Chiến</span>
                <h3 className="text-base font-bold text-white">{currentModule.passage.title}</h3>
              </div>

              {/* Nút bật tắt công nghệ Syntax X-Ray */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsXrayEnabled(!isXrayEnabled)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isXrayEnabled
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                      : 'bg-[#1b2533] text-gray-400 border-transparent hover:text-white'
                  }`}
                >
                  <span>{isXrayEnabled ? '🔬 Syntax X-Ray: BẬT' : '👓 Syntax X-Ray: TẮT'}</span>
                </button>
              </div>
            </div>

            {/* Nội dung bài đọc tuỳ theo kiểu câu hỏi */}
            <div className="space-y-4 text-sm sm:text-base leading-relaxed text-gray-200">
              {/* Paired passage (Cross-Text) */}
              {currentModule.passage.type === 'paired' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#0e1117] border border-[#262730] space-y-2">
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Text 1 (Vance)
                    </span>
                    <p>{renderInteractivePassage(currentModule.passage.text1 || '')}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#0e1117] border border-[#262730] space-y-2">
                    <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Text 2 (Rostova)
                    </span>
                    <p>{renderInteractivePassage(currentModule.passage.text2 || '')}</p>
                  </div>
                </div>
              )}

              {/* Single / Grammar Passage */}
              {(currentModule.passage.type === 'single' || currentModule.passage.type === 'grammar') && (
                <div className="p-4 rounded-xl bg-[#0e1117] border border-[#262730]">
                  <p>{renderInteractivePassage(currentModule.passage.standardText || '')}</p>
                </div>
              )}

              {/* Bullet notes (Rhetorical Synthesis) */}
              {currentModule.passage.type === 'bullet_notes' && (
                <div className="p-4 rounded-xl bg-[#0e1117] border border-[#262730] space-y-2.5">
                  <span className="text-xs font-mono font-bold text-gray-400">
                    Ghi chép của học sinh (Student Research Notes):
                  </span>
                  <ul className="list-disc list-inside space-y-1.5 text-sm text-gray-300">
                    {currentModule.passage.bulletNotes?.map((note, nIdx) => (
                      <li key={nIdx}>{renderInteractivePassage(note)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 🔬 KHUNG GIẢI PHẪU CÂU PHỨC SYNTAX X-RAY */}
            {isXrayEnabled && (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0c1824] to-[#122335] border-2 border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.15)] space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 text-lg">🔬</span>
                    <h4 className="text-xs sm:text-sm font-black text-cyan-300 uppercase tracking-wider">
                      Công Nghệ Syntax X-Ray: Giải Phẫu Câu Phức
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Lọc Nhiễu S-V-O
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#081018] border border-cyan-500/20 text-xs sm:text-sm font-mono text-gray-300 leading-relaxed">
                  <span className="text-gray-400">Câu gốc bóc tách: </span>
                  <span className="text-white italic">"{currentModule.passage.xrayAnalysis.sentenceSnippet}"</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-3 rounded-xl bg-[#081018] border border-cyan-500/30">
                    <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                      [S] Chủ Ngữ Cốt Lõi
                    </span>
                    <p className="text-xs font-bold text-cyan-200">
                      {currentModule.passage.xrayAnalysis.subject}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#081018] border border-amber-500/30">
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block mb-1">
                      [V] Động Từ Chính
                    </span>
                    <p className="text-xs font-bold text-amber-200">
                      {currentModule.passage.xrayAnalysis.verb}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#081018] border border-emerald-500/30">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                      [O/C] Tân Ngữ / Mệnh Đề Sau
                    </span>
                    <p className="text-xs font-medium text-emerald-200 line-clamp-2">
                      {currentModule.passage.xrayAnalysis.objectOrComplement}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/20 text-xs text-gray-300 space-y-1">
                  <div className="text-cyan-300 font-bold flex items-center gap-1.5">
                    <span>💡</span> Nhận định giải phẫu:
                  </div>
                  <p>{currentModule.passage.xrayAnalysis.takeaway}</p>
                  <p className="text-[11px] text-gray-400 italic">
                    Thành phần gây nhiễu đã lược bớt: {currentModule.passage.xrayAnalysis.distractorClause}
                  </p>
                </div>
              </div>
            )}

            {/* 🌾 HƯỚNG DẪN HÁI TỪ VỰNG */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span>🌾</span> Click vào các từ phát sáng <span className="text-purple-300 font-bold">màu tím</span> trong bài đọc để mở pop-up hái ngay vào Hộp 1 Leitner.
              </span>
              <span className="font-mono text-purple-400 font-bold">
                {currentModule.harvestableWords.length} từ học thuật 750+
              </span>
            </div>
          </div>

          {/* 🎯 CÂU HỎI LUYỆN TẬP CHUẨN THI */}
          <div className="bg-[#141824] border border-[#262730] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Câu Hỏi Trọng Tâm
              </span>
              <span className="text-xs text-gray-400">
                Thưởng: <strong className="text-yellow-400 font-bold">+15 XP, +10 Xu</strong>
              </span>
            </div>

            <p className="text-sm sm:text-base font-bold text-white leading-relaxed">
              {currentModule.question.prompt}
            </p>

            <div className="space-y-3">
              {currentModule.question.options.map((opt, oIdx) => {
                const isSelected = selectedOptionIndex === oIdx;
                let btnStyle = 'bg-[#0e1117] border-[#262730] hover:border-gray-500 text-gray-300';

                if (isAnswerSubmitted) {
                  if (opt.isCorrect) {
                    btnStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
                  } else if (isSelected && !opt.isCorrect) {
                    btnStyle = 'bg-red-950/80 border-red-500 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
                  } else {
                    btnStyle = 'bg-[#0e1117]/50 border-[#262730]/50 text-gray-500 opacity-60';
                  }
                } else if (isSelected) {
                  btnStyle = 'bg-purple-950 border-purple-400 text-purple-200';
                }

                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSubmitAnswer(oIdx)}
                    disabled={isAnswerSubmitted}
                    className={`w-full p-4 rounded-xl border text-left transition-all flex items-start gap-3 ${btnStyle}`}
                  >
                    <span className="w-6 h-6 rounded-lg bg-[#1b2533] border border-[#262730] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {opt.label}
                    </span>
                    <div className="space-y-1.5 flex-1">
                      <p className="text-sm font-medium leading-relaxed">{opt.text}</p>
                      {isAnswerSubmitted && (
                        <p className={`text-xs mt-1 pt-1 border-t ${
                          opt.isCorrect ? 'border-emerald-500/30 text-emerald-300 font-semibold' : 'border-red-500/30 text-red-300'
                        }`}>
                          {opt.rationale}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {isAnswerSubmitted && (
              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {(selectedOptionIndex !== null && currentModule.question.options[selectedOptionIndex]?.isCorrect)
                    ? '✅ Phân tích chuẩn xác! Hãy ghi nhớ bẫy này cho đề thi thật.'
                    : '❌ Đừng nản chí! Hãy đọc kỹ phần giải thích chi tiết ở trên.'}
                </span>
                <button
                  onClick={() => {
                    setSelectedOptionIndex(null);
                    setIsAnswerSubmitted(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1b2533] hover:bg-[#26354a] text-gray-200 transition-colors"
                >
                  🔄 Làm lại câu này
                </button>
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI (4 CỘT): DANH SÁCH TỪ VỰNG HỌC THUẬT & POP-UP HÁI TỪ */}
        <div className="lg:col-span-4 space-y-6">
          {/* CARD DANH SÁCH TỪ VỰNG TRONG BÀI ĐỌC */}
          <div className="bg-[#141824] border border-[#262730] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-purple-300 flex items-center gap-2">
                <span>🌾</span> Giỏ Từ Vựng Ngữ Cảnh (750+)
              </h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {currentModule.harvestableWords.length} từ
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Các từ học thuật then chốt xuất hiện trực tiếp trong bài đọc. Click để nghe phát âm và thêm vào Hộp 1 Leitner:
            </p>

            <div className="space-y-2.5">
              {currentModule.harvestableWords.map((item) => {
                const isSaved = savedWordsMap[item.word.toLowerCase().trim()];
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedWord(item)}
                    className="p-3 rounded-xl bg-[#0e1117] border border-[#262730] hover:border-purple-500/50 hover:bg-[#181a26] transition-all cursor-pointer group flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                          {item.word}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500 italic">
                          ({item.partOfSpeech})
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">
                        {item.meaning}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          speakWord(item.word);
                        }}
                        className="p-1.5 rounded-lg bg-[#1b2533] hover:bg-purple-900/50 text-gray-300 hover:text-purple-200 transition-colors text-xs"
                        title="Phát âm tiếng Mỹ"
                      >
                        🔊
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHarvestWord(item);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                          isSaved
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : 'bg-purple-600 hover:bg-purple-500 text-white shadow-sm'
                        }`}
                      >
                        {isSaved ? '✅ Đã Lưu' : '+ Hái'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD POP-UP / DRAWER XEM CHI TIẾT TỪ ĐANG CHỌN */}
          {selectedWord ? (
            <div className="bg-gradient-to-br from-[#1b1c31] to-[#121324] border-2 border-purple-500/50 rounded-2xl p-5 shadow-[0_0_30px_rgba(168,85,247,0.2)] space-y-4 animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between pb-2 border-b border-purple-500/30">
                <span className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider">
                  Giải Phẫu Từ Ngữ Cảnh
                </span>
                <button
                  onClick={() => setSelectedWord(null)}
                  className="text-gray-400 hover:text-white text-xs px-2 py-0.5"
                >
                  ✕ Đóng
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-xl font-black text-white">{selectedWord.word}</h4>
                  <button
                    onClick={() => speakWord(selectedWord.word)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-950 border border-purple-400 text-purple-200 text-xs font-bold hover:bg-purple-900 transition-colors"
                  >
                    <span>🔊</span> {selectedWord.pronunciation}
                  </button>
                </div>
                <span className="text-xs font-mono text-purple-400 italic">
                  Loại từ: {selectedWord.partOfSpeech}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-400 font-bold block mb-0.5">Nghĩa tiếng Việt:</span>
                  <p className="text-gray-200 bg-[#0e1117] p-2.5 rounded-lg border border-[#262730] font-medium">
                    {selectedWord.meaning}
                  </p>
                </div>

                <div>
                  <span className="text-gray-400 font-bold block mb-0.5">Ngữ cảnh trong bài đọc:</span>
                  <p className="text-gray-300 italic bg-[#0e1117] p-2.5 rounded-lg border border-[#262730]">
                    "{selectedWord.contextSentence}"
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-200">
                  <span className="font-bold">Mẹo SAT:</span> {selectedWord.satTip}
                </div>
              </div>

              <button
                onClick={() => handleHarvestWord(selectedWord)}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                  savedWordsMap[selectedWord.word.toLowerCase().trim()]
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30'
                }`}
              >
                <span>{savedWordsMap[selectedWord.word.toLowerCase().trim()] ? '✅' : '🌾'}</span>
                <span>
                  {savedWordsMap[selectedWord.word.toLowerCase().trim()]
                    ? 'Đã Có Trong Hộp 1 Leitner'
                    : '+ Hái Vào Hộp 1 Leitner SRS'}
                </span>
              </button>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-[#0e1117]/60 border border-dashed border-[#262730] text-center text-xs text-gray-500 space-y-2">
              <span className="text-3xl block">📖</span>
              <p>Click vào bất kỳ từ vựng nào trong danh sách hoặc trong bài đọc để xem giải phẫu ngữ cảnh & hái vào Leitner.</p>
            </div>
          )}

          {/* PHÍM TẮT CHUYỂN SANG ÔN TẬP LEITNER */}
          <div className="p-4 rounded-2xl bg-[#141824] border border-[#262730] text-xs space-y-2 text-center">
            <span className="text-gray-400">Đã thu hoạch từ mới?</span>
            <Link
              href="/vocab"
              className="block w-full py-2 px-3 rounded-xl bg-[#1b2533] hover:bg-[#26354a] text-purple-300 font-bold border border-purple-500/30 transition-all text-center"
            >
              🚀 Mở Sổ Từ Leitner SRS Để Ôn Thẻ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
