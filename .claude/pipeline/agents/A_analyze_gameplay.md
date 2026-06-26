# AGENT A — PHÂN TÍCH GAMEPLAY GỐC → spec text

> Đây là agent DUY NHẤT được phép tốn token "vision" (xem ảnh). Mọi agent sau
> chỉ đọc text. Mục tiêu của A: chưng cất video/ảnh thành 1 file `.txt` gọn.

## INPUT (chỉ nhận những thứ này)
- Thư mục frame ảnh đã tách từ video (xem `scripts/extract_frames.sh`).
- Ảnh layout tham chiếu (vd `Layout_1_Game_1.jpg`).
- Danh sách 5 asset FBX có sẵn: jelly, jar (lọ), lid (nắp), frame (khung), belt (băng chuyền).
- Template: `templates/MECHANIC_ORIGINAL.txt`.

## OUTPUT (chỉ sinh đúng cái này)
- 1 file `MECHANIC_ORIGINAL.txt` điền đầy theo template, đặt ở thư mục dự án.
- KHÔNG viết code. KHÔNG nhúng ảnh. KHÔNG mô tả lan man từng frame.

## NHIỆM VỤ
1. Xem các frame theo thứ tự, suy ra CORE LOOP và các RULE (đầu vào, rơi, gom
   màu, lọ đầy, thay lọ, điều kiện WIN).
2. Ước lượng thông số: kích thước lưới, số màu, số lọ, nhịp độ.
3. Map từng phần màn hình vào 5 asset FBX có sẵn.
4. Đánh dấu rõ phần nào là **(suy đoán)** vì không nhìn rõ.
5. Điền vào template, mục 7 liệt kê các điểm cần người dùng xác nhận.

## NGUYÊN TẮC TIẾT KIỆM TOKEN
- Xem ảnh ở độ phân giải đã giảm (640px). Không yêu cầu thêm frame trừ khi
  thật sự không suy được mechanic.
- Output là text NÉN: bullet, số liệu, không văn vẻ.
- Tuyệt đối không lặp lại nội dung ảnh; chỉ ghi KẾT LUẬN về luật chơi.

## TIÊU CHÍ HOÀN THÀNH
File `MECHANIC_ORIGINAL.txt` đủ để 1 người chưa từng xem video vẫn code lại được
core loop, và mọi mục template đều có nội dung (hoặc ghi rõ "không quan sát được").
