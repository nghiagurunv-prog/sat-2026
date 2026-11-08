/**
 * Test Suite: c100-verify-w8.test.mjs
 * Deployment Verification Squad 8 (W8):
 * - Bất biến Chuẩn Thương hiệu & Pháp lý Phú Gia (Hiến Pháp Kỷ Luật Thép Toàn Cục)
 * - Parent Portal & Sharing Features (#C051-#C060, Point 80, NaN Guard #073/#076)
 * - Upgrade & Pricing Transparency (#C061-#C070, Point 87 Parent ROI Matrix, VietQR/Zalo Modal)
 * - Kiểm tra chéo W8 -> W9: Teacher & Admin Cockpit (#C081-#C090, UTF-8 BOM, Presentation Mode)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(relPath) {
  const fullPath = path.join(projectRoot, relPath);
  assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

describe('W8 Verification - Chuẩn Thương Hiệu & Pháp Lý Phú Gia', () => {
  const pricingContent = readProjectFile('src/app/pricing/page.tsx');
  const parentContent = readProjectFile('src/app/parent/page.tsx');
  const upgradeContent = readProjectFile('src/app/upgrade/page.tsx');

  test('Pháp lý Phú Gia: Đúng chuẩn MST / ĐKKD 042203002931', () => {
    assert.match(
      pricingContent,
      /042203002931/,
      'Trang pricing phải công khai MST/ĐKKD chuẩn: 042203002931'
    );
  });

  test('Pháp lý Phú Gia: Đúng chuẩn Hotline duy nhất 0986.722.324', () => {
    assert.match(
      pricingContent,
      /0986\.722\.324/,
      'Trang pricing phải có hotline duy nhất: 0986.722.324'
    );
  });

  test('Pháp lý Phú Gia: Đúng chuẩn Địa chỉ Trương Quốc Dụng (Hà Tĩnh)', () => {
    assert.match(
      pricingContent,
      /Trương Quốc Dụng/,
      'Trang pricing phải ghi đúng tên đường có dấu: Trương Quốc Dụng'
    );
    assert.match(
      pricingContent,
      /Hà Tĩnh/,
      'Trang pricing phải có địa bàn Thành Sen, Hà Tĩnh'
    );
  });

  test('Pháp lý Phú Gia: Tên đơn vị / thương hiệu chuẩn Phú Gia', () => {
    assert.match(
      pricingContent,
      /Phú Gia/,
      'Trang pricing phải hiển thị thương hiệu Phú Gia'
    );
    assert.match(
      pricingContent,
      /Nguyễn Trọng Nghĩa/,
      'Trang pricing phải ghi nhận người đại diện hợp pháp: Nguyễn Trọng Nghĩa'
    );
  });

  test('Kỷ Luật Thép: Tuyệt đối CẤM các số điện thoại / MST / Địa chỉ giả hoặc cũ', () => {
    const forbiddenPatterns = [
      { pattern: /0973\.?562\.?789/, label: 'SĐT giả 0973.562.789' },
      { pattern: /0912\.?345\.?678/, label: 'SĐT giả 0912.345.678' },
      { pattern: /0988\.?888\.?999/, label: 'SĐT giả 0988.888.999' },
      { pattern: /0868\.?448\.?625/, label: 'SĐT giả 0868.448.625' },
      { pattern: /2500732386/, label: 'MST giả Vĩnh Phúc 2500732386' },
      { pattern: /3002228888/, label: 'MST giả 3002228888' },
      { pattern: /35\s+Ngô\s+Đức\s+Kế/i, label: 'Địa chỉ cũ sai 35 Ngô Đức Kế' },
      { pattern: /đường\s+Hàm\s+Nghi/i, label: 'Địa chỉ bịa đặt Hàm Nghi' },
      { pattern: /Trương\s+Quốc\s+Dung(?!\w)/i, label: 'Sai chính tả Trương Quốc Dung (thiếu dấu nặng)' },
      { pattern: /xưởng\s+mộc/i, label: 'Danh xưng cấm "xưởng mộc"' }
    ];

    const filesToCheck = [
      { name: 'pricing', content: pricingContent },
      { name: 'parent', content: parentContent },
      { name: 'upgrade', content: upgradeContent }
    ];

    for (const { name, content } of filesToCheck) {
      for (const { pattern, label } of forbiddenPatterns) {
        assert.ok(
          !pattern.test(content),
          `Phát hiện vi phạm Kỷ luật Thép Phú Gia [${label}] trong file ${name}`
        );
      }
    }
  });
});

describe('W8 Verification - Parent Portal & Parent Sharing Features', () => {
  const parentContent = readProjectFile('src/app/parent/page.tsx');
  const parentShareContent = readProjectFile('src/app/parent-share/page.tsx');

  test('#C051-#C060: Bảng điều khiển phụ huynh đầy đủ 10 tính năng chủ chốt', () => {
    // #C051: Giải thích thuật ngữ Tiếng Việt cho phụ huynh
    assert.match(parentContent, /#C051/, 'Thiếu chú thích/tính năng #C051');
    assert.match(parentContent, /showGlossary|Giải thích.*Phụ huynh/i, 'Thiếu logic mở rộng giải thích thuật ngữ SAT');

    // #C052: Thời lượng tập trung thực chất
    assert.match(parentContent, /#C052/, 'Thiếu chú thích/tính năng #C052');
    assert.match(parentContent, /Thời lượng Tập trung Thực chất|Active Focus Verification/i, 'Thiếu #C052: Phân tích thời gian tập trung');

    // #C053: Bảng đối chiếu ngưỡng xét tuyển ĐH Trọng điểm VN
    assert.match(parentContent, /#C053/, 'Thiếu chú thích/tính năng #C053');
    assert.match(parentContent, /Bảng Đối Chiếu Ngưỡng Xét Tuyển Đại Học|VIETNAMESE_UNIVERSITIES/i, 'Thiếu #C053: Bảng đối chiếu ĐH');

    // #C054: Ước tính giá trị học bổng tiềm năng (ROI học tập)
    assert.match(parentContent, /#C054/, 'Thiếu chú thích/tính năng #C054');
    assert.match(parentContent, /Học bổng Tiềm năng|ROI Học tập/i, 'Thiếu #C054: ROI học bổng');

    // #C055: Xuất phiếu báo cáo Zalo gia đình
    assert.match(parentContent, /#C055/, 'Thiếu chú thích/tính năng #C055');
    assert.match(parentContent, /Báo Cáo.*Zalo|handleCopyZalo/i, 'Thiếu #C055: Xuất bản tin Zalo 1-chạm');

    // #C056 & #C057: Điểm con làm tốt nhất & Trọng tâm tuần tới
    assert.match(parentContent, /#C056/, 'Thiếu chú thích/tính năng #C056');
    assert.match(parentContent, /#C057/, 'Thiếu chú thích/tính năng #C057');
    assert.match(parentContent, /Điểm Con Làm Tốt Nhất.*Trọng Tâm/i, 'Thiếu #C056/#C057');

    // #C058: Gửi lời nhắn động viên cho con
    assert.match(parentContent, /#C058/, 'Thiếu chú thích/tính năng #C058');
    assert.match(parentContent, /encouragementNote|Gửi Lời Động Viên/i, 'Thiếu #C058: Gửi lời động viên');

    // #C059: Lịch thi SAT Quốc tế chính thức từ College Board
    assert.match(parentContent, /#C059/, 'Thiếu chú thích/tính năng #C059');
    assert.match(parentContent, /OFFICIAL_SAT_DATES|Lịch thi SAT/i, 'Thiếu #C059: Lịch thi SAT');

    // #C060: Quản lý mã truy cập gần đây (recent codes)
    assert.match(parentContent, /#C060/, 'Thiếu chú thích/tính năng #C060');
    assert.match(parentContent, /recentCodes|sat_parent_recent_codes/i, 'Thiếu #C060: Recent access codes');
  });

  test('An toàn số học: Khử triệt để lỗi NaN & Chia cho 0 (#073, #076)', () => {
    assert.match(parentContent, /#073/, 'Phải ghi chú tuân thủ quy chuẩn an toàn số học #073');
    assert.match(parentContent, /#076/, 'Phải ghi chú tuân thủ quy chuẩn an toàn số học #076');
    assert.match(parentContent, /Number\.isFinite|isFinite/, 'Parent page phải kiểm tra isFinite để chống NaN');
  });

  test('Point 80: Visual SVG QR Code cho phụ huynh quét Zalo trên trang parent-share', () => {
    assert.match(parentShareContent, /svg/i, 'Trang parent-share phải có SVG QR Code');
    assert.match(parentShareContent, /viewBox="0 0 100 100"/, 'QR code SVG phải có viewBox hợp lệ');
    assert.match(parentShareContent, /Zalo/, 'Phải hỗ trợ quét mã hoặc chia sẻ qua Zalo');
  });
});

describe('W8 Verification - Upgrade & Pricing Transparency', () => {
  const upgradeContent = readProjectFile('src/app/upgrade/page.tsx');
  const pricingContent = readProjectFile('src/app/pricing/page.tsx');

  test('Point 87: Bảng so sánh chi phí & quyền lợi phụ huynh (Parent ROI Matrix)', () => {
    assert.match(
      upgradeContent,
      /POINT 87/i,
      'Trang upgrade phải có chú thích quy chuẩn POINT 87'
    );
    assert.match(
      upgradeContent,
      /Parent ROI Matrix|Hiệu Quả Đầu Tư Dành Cho Phụ Huynh/i,
      'Trang upgrade phải có bảng Parent ROI Matrix'
    );
  });

  test('Thanh toán VietQR / Zalo 1 chạm cho phụ huynh', () => {
    assert.match(
      upgradeContent,
      /payos|vietqr/i,
      'Trang upgrade phải hỗ trợ cổng thanh toán VietQR / PayOS'
    );
    assert.match(
      upgradeContent,
      /Nhờ Phụ Huynh thanh toán VietQR|Mở VietQR Thanh Toán Cho Con/i,
      'Phải có cơ chế định vị phụ huynh thanh toán cho con'
    );
  });

  test('#C061-#C070: Bảng giá minh bạch và phân cấp gói rõ ràng', () => {
    assert.match(pricingContent, /#C061/, 'Trang pricing phải có #C061');
    assert.match(pricingContent, /#C062/, 'Trang pricing phải có #C062');
    assert.match(pricingContent, /#C068/, 'Trang pricing phải có quy đổi chi phí siêu nhỏ #C068');
    assert.match(pricingContent, /#C070/, 'Trang pricing phải có khối pháp lý chuẩn #C070');
    assert.match(pricingContent, /SPRINT_EXAM_PACKS/, 'Trang pricing phải có gói thi tăng tốc SPRINT');
  });
});

describe('W8 -> W9 Cross-Check: Teacher & Admin Cockpit Verification', () => {
  const adminContent = readProjectFile('src/app/admin/page.tsx');

  test('#C081: Bản đồ nhiệt lỗ hổng kỹ năng lớp học (Classroom Skill Gap Heatmap)', () => {
    assert.match(adminContent, /#C081/, 'Thiếu chú thích/triển khai #C081 trong admin');
    assert.match(adminContent, /Bản Đồ Nhiệt|selectedHeatmapSkill/i, 'Thiếu cơ chế Heatmap');
  });

  test('#C082: Giao bài tập phân hóa 1-click qua Zalo', () => {
    assert.match(adminContent, /#C082/, 'Thiếu chú thích/triển khai #C082 trong admin');
    assert.match(adminContent, /copyZaloAssignment|Giao Bài 1-Click/i, 'Thiếu hàm giao bài qua Zalo');
  });

  test('#C083: Radar cảnh báo sớm học sinh nguy cơ (At-Risk Early Warning Radar)', () => {
    assert.match(adminContent, /#C083/, 'Thiếu chú thích/triển khai #C083 trong admin');
    assert.match(adminContent, /At-Risk|atRiskFilter/i, 'Thiếu bộ lọc hoặc radar học sinh có nguy cơ');
  });

  test('#C084: Nhật ký kích hoạt mã & chống lạm dụng (Redemptions Audit Trail)', () => {
    assert.match(adminContent, /#C084/, 'Thiếu chú thích/triển khai #C084 trong admin');
    assert.match(adminContent, /redemptions|đổi thưởng/i, 'Thiếu quản lý redemptions audit');
  });

  test('#C085: Xuất dữ liệu Excel chuẩn UTF-8 BOM chống lỗi font tiếng Việt', () => {
    assert.match(adminContent, /#C085/, 'Thiếu chú thích/triển khai #C085 trong admin');
    assert.match(adminContent, /\\uFEFF/, 'Phải sử dụng UTF-8 BOM (\\uFEFF) để Excel không lỗi font tiếng Việt');
  });

  test('#C086: Chế độ bảo mật trình chiếu (Presentation Mode) che giấu PII', () => {
    assert.match(adminContent, /#C086/, 'Thiếu chú thích/triển khai #C086 trong admin');
    assert.match(adminContent, /presentationMode/, 'Phải có state presentationMode');
    assert.match(adminContent, /maskEmail/, 'Phải có hàm che email học sinh');
    assert.match(adminContent, /maskPhone/, 'Phải có hàm che SĐT học sinh');
    assert.match(adminContent, /maskMoney/, 'Phải có hàm che số tiền doanh thu');
  });

  test('#C087-#C088: Ngân hàng mẹo giải giáo viên & Gợi ý cải tiến câu hỏi', () => {
    assert.match(adminContent, /#C087/, 'Thiếu chú thích/triển khai #C087 trong admin');
    assert.match(adminContent, /#C088/, 'Thiếu chú thích/triển khai #C088 trong admin');
    assert.match(adminContent, /TeacherTip|INITIAL_TEACHER_TIPS/i, 'Thiếu cấu trúc dữ liệu mẹo giải giáo viên');
  });

  test('#C089: Giám sát chi phí AI & Tỷ lệ Cache Hit (AI Cost vs Cache Monitor)', () => {
    assert.match(adminContent, /ai_cost/, 'Thiếu tab giám sát chi phí AI');
    assert.match(adminContent, /Cache/i, 'Thiếu hiển thị tỷ lệ cache');
  });

  test('#C090: Bộ lọc đa lớp Cohort Filter quản lý học sinh theo nhóm', () => {
    assert.match(adminContent, /#C090/, 'Thiếu chú thích/triển khai #C090 trong admin');
    assert.match(adminContent, /selectedClassFilter|Cohort/i, 'Thiếu bộ lọc phân lớp Cohort');
  });
});
