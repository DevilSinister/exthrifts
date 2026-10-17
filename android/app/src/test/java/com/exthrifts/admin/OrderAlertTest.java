package com.exthrifts.admin;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import java.util.HashMap;
import java.util.Map;
import org.junit.Test;

public final class OrderAlertTest {
    private static final String TITLE = "New order";
    private static final String BODY = "Tap to open the order.";

    private static Map<String, String> order() {
        Map<String, String> data = new HashMap<>();
        data.put("type", "order");
        data.put("orderId", "cm9x2k1ab0001");
        data.put("number", "EX-1042");
        data.put("title", "New order EX-1042 · Rs 4,500");
        data.put("body", "Ali, Lahore — 2 pieces");
        data.put("targetPath", "/admin/orders/cm9x2k1ab0001");
        return data;
    }

    @Test public void parsesTheWebsitesOrderPayload() {
        OrderAlert alert = OrderAlert.parse(order(), TITLE, BODY);
        assertNotNull(alert);
        assertEquals("order-cm9x2k1ab0001", alert.tag);
        assertEquals("New order EX-1042 · Rs 4,500", alert.title);
        assertEquals("Ali, Lahore — 2 pieces", alert.body);
        assertEquals("/admin/orders/cm9x2k1ab0001", alert.targetPath);
    }

    @Test public void theSameOrderAlwaysGetsTheSameTag() {
        assertEquals(OrderAlert.parse(order(), TITLE, BODY).tag, OrderAlert.parse(order(), TITLE, BODY).tag);
    }

    @Test public void dropsMessagesThatAreNotOurs() {
        assertNull(OrderAlert.parse(null, TITLE, BODY));
        assertNull(OrderAlert.parse(new HashMap<>(), TITLE, BODY));
        Map<String, String> other = order();
        other.put("type", "promo");
        assertNull(OrderAlert.parse(other, TITLE, BODY));
    }

    @Test public void dropsAnOrderWithoutAUsableId() {
        Map<String, String> data = order();
        data.remove("orderId");
        assertNull(OrderAlert.parse(data, TITLE, BODY));
        data.put("orderId", "../../etc");
        assertNull(OrderAlert.parse(data, TITLE, BODY));
        data.put("orderId", "x".repeat(65));
        assertNull(OrderAlert.parse(data, TITLE, BODY));
    }

    @Test public void fallsBackToTheNumberWhenTitleIsMissing() {
        Map<String, String> data = order();
        data.remove("title");
        data.put("body", "  ");
        OrderAlert alert = OrderAlert.parse(data, TITLE, BODY);
        assertEquals("New order EX-1042", alert.title);
        assertEquals(BODY, alert.body);
    }

    @Test public void clipsTitleAndBody() {
        Map<String, String> data = order();
        data.put("title", "t".repeat(200));
        data.put("body", "b".repeat(500));
        OrderAlert alert = OrderAlert.parse(data, TITLE, BODY);
        assertEquals(120, alert.title.length());
        assertEquals(240, alert.body.length());
    }

    @Test public void acceptsTheTestAlertWithItsOwnTag() {
        Map<String, String> data = new HashMap<>();
        data.put("type", "test");
        data.put("title", "ExThrifts: test alert");
        data.put("body", "Order alerts are working on this phone.");
        data.put("targetPath", "/admin/orders");
        data.put("tag", "test-1760000000000");
        OrderAlert alert = OrderAlert.parse(data, TITLE, BODY);
        assertEquals("test-1760000000000", alert.tag);
        assertEquals("/admin/orders", alert.targetPath);
        data.put("tag", "bad tag!");
        assertEquals("test", OrderAlert.parse(data, TITLE, BODY).tag);
    }

    @Test public void keepsAdminPaths() {
        assertEquals("/admin/orders/abc", OrderAlert.safePath("/admin/orders/abc"));
        assertEquals("/admin/orders?status=NEW", OrderAlert.safePath("/admin/orders?status=NEW"));
        assertEquals("/admin/", OrderAlert.safePath("/admin/"));
    }

    @Test public void replacesAnythingElseWithTheOrdersList() {
        String[] rejected = {
            null, "", "admin/orders", "/admin", "/shop/cart", "//evil.example/admin/x",
            "https://evil.example/admin/orders", "/admin/../api/secret", "/admin//evil",
            "/admin/orders/1#x", "/admin/orders/%2e%2e", "/admin/orders\\x", "/admin/orders/a b",
            "/admin/orders/a\nb", "javascript:alert(1)", "/admin/" + "a".repeat(200),
        };
        for (String path : rejected) assertEquals(String.valueOf(path), "/admin/orders", OrderAlert.safePath(path));
    }

    @Test public void anUnsafeTargetStillShowsTheAlert() {
        Map<String, String> data = order();
        data.put("targetPath", "https://evil.example/");
        assertEquals("/admin/orders", OrderAlert.parse(data, TITLE, BODY).targetPath);
    }
}
